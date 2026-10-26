import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deals, offices, tasks } from "@/db/schema";
import { can } from "@/lib/perm";
import { canSeeOffice, deskMembers } from "@/lib/desk";
import { setTaskDone, snoozeTask } from "@/lib/desk-actions";
import { DkToast, Ico, shortDay } from "@/components/DeskApp";
import { istDay } from "@/lib/stages";

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };

// One task, reached from the 9 AM reminder email or the Monday summary: mark it done or push it out in one tap.
export default async function DeskTask({ params, searchParams }: P) {
  const me = await requireDesk();
  const [{ id: raw }, { msg }] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const [t] = await db.select().from(tasks).where(eq(tasks.id, Number(raw) || 0));
  if (!t) notFound();
  const [d] = t.dealId ? await db.select({ id: deals.id, company: deals.company, listed: deals.listed }).from(deals).where(eq(deals.id, t.dealId)) : [];
  const [o] = t.officeId ? await db.select().from(offices).where(eq(offices.id, t.officeId)) : [];
  if (o && !canSeeOffice(me, o)) notFound();
  const members = await deskMembers();
  const who = members.find((m) => m.id === t.assigneeId)?.name ?? "Nobody";
  const back = `/desk/tasks/${t.id}`;
  const work = can(me, "workflow"), today = istDay();
  return (
    <>
      <DkToast msg={msg} />
      <a className="dk-back" href="/desk/tasks"><Ico d="M15 6l-6 6 6 6" size={18} /> Tasks</a>
      <header className="dk-dealhead">
        <span className={`dk-pill${t.status === "done" ? "" : t.dueOn && t.dueOn < today ? " bad" : ""}`}>{t.status === "done" ? `Done${t.doneBy ? ` by ${t.doneBy}` : ""}` : t.dueOn ? (t.dueOn < today ? `Overdue since ${t.dueOn}` : t.dueOn === today ? "Due today" : `Due ${t.dueOn}`) : "No date"}</span>
        <h1 style={{ fontSize: 22 }}>{t.title}</h1>
        <p>For {who}{d ? <> · <a href={`/desk/deals/${d.id}`}>{d.company}</a></> : ""}{o ? <> · <a href={`/desk/investors/${o.id}`}>{o.name}</a></> : ""} · added {shortDay(t.createdAt)}{t.createdBy ? ` by ${t.createdBy}` : ""}</p>
      </header>
      {t.notes && <section className="dk-sec"><h2>Notes</h2><p style={{ whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.5 }}>{t.notes}</p></section>}
      {work && <section className="dk-sec dk-ctl">
        <form action={setTaskDone}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.status === "done" ? "0" : "1"} /><input type="hidden" name="back" value={back} />
          <button className="dk-btn" type="submit">{t.status === "done" ? "Reopen" : "Mark done"}</button></form>
        {t.status !== "done" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{[[1, "Tomorrow"], [3, "In 3 days"], [7, "Next week"]].map(([n, l]) => (
          <form key={n} action={snoozeTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="days" value={n} /><input type="hidden" name="back" value={back} />
            <button className="dk-btn sm ghost" type="submit">Move to {String(l).toLowerCase()}</button></form>))}</div>}
      </section>}
      <a className="dk-console" href="/admin/tasks"><Ico d="M4 6h16M4 12h16M4 18h10" size={18} /> All tasks in the console</a>
    </>
  );
}
