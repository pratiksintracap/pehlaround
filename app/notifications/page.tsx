import type { Metadata } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifications } from "@/db/schema";
import { isDesk } from "@/lib/perm";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Notifications() {
  const user = await requireUser("/notifications");
  const db = await getDb();
  const admin = isDesk(user);
  const mine = admin ? eq(notifications.toAdmin, true) : user.office ? eq(notifications.officeId, user.office.id) : undefined;
  const rows = mine ? await db.select().from(notifications).where(mine).orderBy(desc(notifications.createdAt)).limit(100) : [];
  if (mine) await db.update(notifications).set({ readAt: new Date() }).where(and(mine, isNull(notifications.readAt)));
  return (
    <main className="wrap notes-page">
      <span className="eyebrow">{admin ? "Desk alerts" : user.office?.name || "Your office"}</span>
      <h1>Notifications</h1>
      <p className="fine">{admin ? "New registrations, NDAs, questions, call and allocation requests and founder leads." : "Approvals, answers from promoters, new documents, calls and allocation updates from the desk."}</p>
      <ul className="note-list">
        {rows.length ? rows.map((n) => {
          const inner = <><span className="when">{fmtT(n.createdAt)}</span><b>{n.title}</b>{n.body && <p>{n.body}</p>}</>;
          return <li key={n.id} className={n.readAt ? "" : "new"}>{n.link ? <a href={n.link}>{inner}</a> : <div>{inner}</div>}</li>;
        }) : <li className="empty-li">Nothing yet. {admin ? "" : "You will be told here when the desk approves your office, a promoter answers a question or a document is added."}</li>}
      </ul>
      <p><a className="btn" href={admin ? "/admin" : "/dashboard"}>{admin ? "Back to admin" : "Back to the dashboard"}</a></p>
    </main>
  );
}
