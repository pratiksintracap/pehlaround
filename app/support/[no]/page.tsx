import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ticketMessages, tickets, users } from "@/db/schema";
import { listDeals } from "@/lib/deals";
import { STATUS, catLabel, idFromNo, ticketNo } from "@/lib/tickets";

export const metadata: Metadata = { title: "Support ticket", robots: { index: false } };
const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Ticket({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const user = await requireUser(`/support/${no}`);
  const db = await getDb();
  const [t] = await db.select().from(tickets).where(eq(tickets.id, idFromNo(no) || -1));
  if (!t || (user.role !== "admin" && (!user.officeId || t.officeId !== user.officeId))) notFound();
  const [msgs, raiser, deals] = await Promise.all([
    db.select().from(ticketMessages).where(and(eq(ticketMessages.ticketId, t.id), eq(ticketMessages.internal, false))).orderBy(asc(ticketMessages.createdAt)),
    db.select({ name: users.name }).from(users).where(eq(users.id, t.userId)), listDeals(),
  ]);
  const deal = deals.find((d) => d.id === t.dealId);
  const st = STATUS[t.status] ?? { office: t.status, pill: "" };
  const live = t.status !== "closed";
  return (
    <main><div className="wrap tk-wrap">
      <a className="btn sm ghost" href="/dashboard#Support">← Help and support</a>
      <header className="tk-head">
        <div><span className="mono tk-no">{ticketNo(t.id)}</span><h1>{t.subject}</h1>
          <p className="fine">{catLabel(t.category)}{deal ? <> · <a href={`/room/${deal.slug}`}>{deal.company}</a></> : null} · raised by {raiser[0]?.name ?? "your office"} on {fmtT(t.createdAt)}</p></div>
        <span className={`pill ${st.pill}`}>{st.office}</span>
      </header>
      <ol className="tk-thread">{msgs.map((m) => m.from === "system"
        ? <li key={m.id} className="sys"><span>{m.body}</span><time>{fmtT(m.createdAt)}</time></li>
        : <li key={m.id} className={m.from}><div className="tk-by"><b>{m.from === "desk" ? "Off Market Desk" : m.who}</b>{m.from === "desk" && m.who && <small> · {m.who}</small>}<time>{fmtT(m.createdAt)}</time></div><p>{m.body}</p></li>)}</ol>
      {t.status === "resolved" && !t.rating && (
        <form className="form tk-rate" method="post" action={`/api/tickets/${ticketNo(t.id)}/rate`} data-api="">
          <span className="k">How did the desk do?</span>
          <div className="tk-stars" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <label key={n}><input type="radio" name="rating" value={n} required /><span>{n}</span></label>)}</div>
          <label>Anything to add? (optional)<input name="note" maxLength={500} /></label>
          <div><button className="btn sm" type="submit">Send rating</button></div>
        </form>
      )}
      {t.rating && <p className="fine tk-rated">You rated this {t.rating}/5{t.ratingNote ? `: “${t.ratingNote}”` : "."} Thank you.</p>}
      {live ? (
        <div className="tk-acts">
          <form className="form tk-reply" method="post" action={`/api/tickets/${ticketNo(t.id)}/reply`} data-api="">
            <label>{t.status === "resolved" ? "Not sorted after all? Reply to reopen it" : "Reply"}<textarea name="body" required rows={4} maxLength={5000} placeholder="Write to the desk" /></label>
            <div><button className="btn primary" type="submit">Send reply</button></div>
          </form>
          {(t.status === "open" || t.status === "answered") && (
            <form method="post" action={`/api/tickets/${ticketNo(t.id)}/resolve`} data-api="" className="tk-resolve"><button className="btn sm ghost" type="submit">Mark as resolved</button></form>
          )}
        </div>
      ) : <p className="notice">This ticket is closed. If you need the desk again, <a href="/dashboard#Support">raise a new ticket</a>.</p>}
    </div></main>
  );
}
