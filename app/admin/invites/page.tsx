import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deskInvites } from "@/db/schema";
import { createInvites, sendSampleInvite } from "@/lib/admin-actions";
import { emailReady } from "@/lib/notify";
import { SITE_URL } from "@/lib/site";
import { Msg } from "@/components/AdminBits";

const fmtD = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export default async function Invites({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(deskInvites).orderBy(desc(deskInvites.createdAt)).limit(300);
  const mail = emailReady();
  const used = rows.filter((r) => r.usedAt).length;
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Invite family offices</h1>
      <p className="fine" style={{ marginBottom: 16 }}>Each invitation is a personal link. The office registers through it already approved, so it sees every company by name at once. Paste your list, one office per line: name, email, family office. {mail ? "Tick the box to email the links from the desk." : "Email is not set up yet: copy each link into your own email or WhatsApp."}</p>
      <div className="two">
        <form action={createInvites} className="form chart">
          <label>Offices to invite<textarea name="list" rows={8} required placeholder={"Sanjay Shah, sanjay@shahfamily.in, Shah Family Office\nPriya Mehta, priya@mehta.co, Mehta Family Trust"} /></label>
          <label className="check"><input type="checkbox" name="send" defaultChecked={mail} disabled={!mail} /> Email each link from the desk</label>
          <div><button className="btn primary" type="submit">Create invitations</button></div>
        </form>
        {mail && <form action={sendSampleInvite} className="form chart" style={{ gridColumn: "1 / -1" }}>
          <span className="k">See what an investor gets</span>
          <p className="fine" style={{ margin: "6px 0 10px" }}>Emails you the invitation as it would reach an investor, signed by you. The link in the sample does not open anything.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><label>Name<input name="name" placeholder="Sanjay Shah" /></label><label>Family office<input name="officeName" placeholder="Shah Family Office" /></label></div>
          <div><button className="btn" type="submit">Send me a sample</button></div>
        </form>}
        <div className="chart"><span className="k">Invitations · {rows.length} sent · {used} registered</span>
          <ul className="feed inv">{rows.length ? rows.map((r) => (
            <li key={r.id}><b>{r.officeName || r.name || r.email}</b> <span className={`pill ${r.usedAt ? "ok" : ""}`}>{r.usedAt ? "Registered" : "Not yet"}</span><br />
              <small className="fine">{r.name ? `${r.name} · ` : ""}{r.email} · {fmtD(r.createdAt)}</small>
              {!r.usedAt && <input className="mono copy" readOnly value={`${SITE_URL}/invite/${r.token}`} />}</li>))
            : null}</ul>{!rows.length && <p className="fine">No invitations yet.</p>}</div>
      </div>
    </>
  );
}
