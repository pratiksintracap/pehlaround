import { requireAdmin } from "@/lib/auth";
import { asc, desc, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { broadcasts, deals, offices } from "@/db/schema";
import { sendBroadcast } from "@/lib/admin-actions";
import { emailReady } from "@/lib/notify";
import { Msg } from "@/components/AdminBits";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const AUD: Record<string, string> = { approved: "All approved offices", all: "Every registered office", pending: "Offices awaiting approval", deal: "Offices that signed a company's NDA", office: "One office" };

export default async function Notify({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = await getDb();
  const [ds, os, hist] = await Promise.all([
    db.select({ id: deals.id, company: deals.company }).from(deals).orderBy(asc(deals.sort)),
    db.select({ id: offices.id, name: offices.name }).from(offices).where(ne(offices.approval, "rejected")).orderBy(asc(offices.name)),
    db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(40),
  ]);
  const dealName = new Map(ds.map((d) => [d.id, d.company]));
  const mail = emailReady();
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Notify offices</h1>
      <p className="fine" style={{ marginBottom: 16 }}>Messages appear under the bell in each office&apos;s dashboard and in the app. {mail ? "Offices that allow email also get it by email." : "Email is not set up yet, so messages go in-app only (see Settings)."}
        {" "}Offices are also told automatically when you approve them, answer a question in a room they signed, add a document to that room, schedule a call or change an allocation request.</p>
      <div className="two">
        <form action={sendBroadcast} className="form chart">
          <label>Send to
            <select name="audience" defaultValue="approved">{Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="row">
            <label>Company (for NDA offices)<select name="dealId">{ds.map((d) => <option key={d.id} value={d.id}>{d.company}</option>)}</select></label>
            <label>Office (for one office)<select name="officeId"><option value="">—</option>{os.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          </div>
          <label>Title<input name="title" required maxLength={200} placeholder="New: Karthik Agro room is open" /></label>
          <label>Message<textarea name="body" rows={5} maxLength={4000} placeholder="Two or three lines. Plain text." /></label>
          <label>Link (optional)<input name="link" maxLength={500} placeholder="/deals/karthik-agro or a full https:// address" /></label>
          <label className="check"><input type="checkbox" name="email" defaultChecked={mail} disabled={!mail} /> Also email offices that allow it</label>
          <div><button className="btn primary" type="submit">Send</button></div>
        </form>
        <div className="chart"><span className="k">Sent</span>
          <ul className="feed">{hist.length ? hist.map((b) => (
            <li key={b.id}><span className="mono">{fmtT(b.createdAt)}</span><b>{b.title}</b><br />
              <small className="fine">{AUD[b.audience] || b.audience}{b.dealId ? ` · ${dealName.get(b.dealId)}` : ""} · {b.recipients} {b.recipients === 1 ? "office" : "offices"}{b.emailed ? ` · ${b.emailed} emails` : ""} · {b.sentBy}</small></li>))
            : null}</ul>{!hist.length && <p className="fine">Nothing sent yet.</p>}</div>
      </div>
    </>
  );
}
