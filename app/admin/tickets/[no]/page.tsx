import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { can, mask } from "@/lib/perm";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { offices, ticketMessages, tickets, users } from "@/db/schema";
import { listDeals } from "@/lib/deals";
import { STATUS, catLabel, idFromNo, ticketNo } from "@/lib/tickets";
import { deskReply } from "../actions";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function DeskTicket({ params }: { params: Promise<{ no: string }> }) {
  const me = await requireDesk();
  const seeContacts = can(me, "contacts.view", { analystContacts: (await getSettings()).analystContacts });
  const { no } = await params;
  const db = await getDb();
  const [t] = await db.select().from(tickets).where(eq(tickets.id, idFromNo(no) || -1));
  if (!t) notFound();
  const [msgs, [u], [o], deals] = await Promise.all([
    db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, t.id)).orderBy(asc(ticketMessages.createdAt)),
    db.select().from(users).where(eq(users.id, t.userId)),
    t.officeId ? db.select().from(offices).where(eq(offices.id, t.officeId)) : Promise.resolve([undefined]),
    listDeals(true),
  ]);
  const deal = deals.find((d) => d.id === t.dealId);
  const st = STATUS[t.status] ?? { label: t.status, pill: "" };
  return (
    <>
      <a className="btn sm ghost" href="/admin/tickets">← All tickets</a>
      <header className="tk-head">
        <div><span className="mono tk-no">{ticketNo(t.id)}</span><h1>{t.subject}</h1>
          <p className="fine">{catLabel(t.category)}{deal ? <> · <a href={`/room/${deal.slug}`}>{deal.company}</a></> : null} · opened {fmtT(t.createdAt)}{t.firstReplyAt ? ` · first reply after ${((t.firstReplyAt.getTime() - t.createdAt.getTime()) / 36e5).toFixed(1)} h` : ""}</p></div>
        <span className={`pill ${st.pill}`}>{st.label}</span>
      </header>
      <div className="tk-who chart">
        <span><b>{o?.name ?? "—"}</b> <small className="fine">{o?.approval ?? ""}</small></span>
        <span>{u?.name} · {seeContacts ? <a href={`mailto:${u?.email}`}>{u?.email}</a> : mask(u?.email)}{u?.phone ? ` · ${seeContacts ? u.phone : mask(u.phone)}` : ""}</span>
        {t.rating && <span>Rated <b>{t.rating}/5</b>{t.ratingNote ? `: “${t.ratingNote}”` : ""}</span>}
        <a href="/admin/offices">Open in Family offices →</a>
      </div>
      <ol className="tk-thread">{msgs.map((m) => m.from === "system"
        ? <li key={m.id} className="sys"><span>{m.body}</span><time>{fmtT(m.createdAt)}</time></li>
        : <li key={m.id} className={`${m.from}${m.internal ? " internal" : ""}`}><div className="tk-by"><b>{m.from === "desk" ? (m.internal ? `Internal note · ${m.who}` : `Desk · ${m.who}`) : m.who}</b><time>{fmtT(m.createdAt)}</time></div><p>{m.body}</p></li>)}</ol>
      <form action={deskReply} className="form tk-reply chart">
        <input type="hidden" name="no" value={ticketNo(t.id)} />
        <label>Reply to {u?.name?.split(" ")[0] ?? "the office"}<textarea name="body" rows={5} maxLength={5000} placeholder="Your reply goes to the office under the bell and by email" /></label>
        <div className="row">
          <label className="check"><input type="checkbox" name="internal" /> <span>Internal note: the office does not see it</span></label>
          <label>Then mark it<select name="status" defaultValue=""><option value="">Awaiting office (after a reply)</option><option value="open">Keep it with the desk</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
        </div>
        <div><button className="btn primary" type="submit">Send</button></div>
      </form>
    </>
  );
}
