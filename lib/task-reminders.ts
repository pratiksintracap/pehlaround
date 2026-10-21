import "server-only";
// The 9 AM IST run: one email per desk member listing their open tasks that are due today or overdue.
// Each task is counted at most once a day (remindedOn), so a re-run the same morning sends nothing new.
import { and, eq, inArray, isNotNull, lte, or, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, offices, tasks, users } from "@/db/schema";
import { emailReady, sendRaw, layout, E, esc } from "@/lib/email";
import { istDay } from "@/lib/stages";

export async function runTaskReminders(now = new Date()) {
  const today = istDay(now);
  const db = await getDb();
  const due = await db.select().from(tasks).where(and(eq(tasks.status, "open"), isNotNull(tasks.assigneeId), isNotNull(tasks.dueOn), lte(tasks.dueOn, today),
    or(isNull(tasks.remindedOn), ne(tasks.remindedOn, today))));
  if (!due.length) return { people: 0, tasks: 0 };
  const people = await db.select({ id: users.id, name: users.name, email: users.email }).from(users)
    .where(and(inArray(users.id, [...new Set(due.map((t) => t.assigneeId!))]), inArray(users.role, ["admin", "analyst"]), eq(users.disabled, false)));
  const dIds = [...new Set(due.map((t) => t.dealId).filter(Boolean))] as number[], oIds = [...new Set(due.map((t) => t.officeId).filter(Boolean))] as number[];
  const [ds, os] = await Promise.all([
    dIds.length ? db.select({ id: deals.id, company: deals.company }).from(deals).where(inArray(deals.id, dIds)) : Promise.resolve([]),
    oIds.length ? db.select({ id: offices.id, name: offices.name }).from(offices).where(inArray(offices.id, oIds)) : Promise.resolve([]),
  ]);
  const dn = new Map(ds.map((d) => [d.id, d.company])), on = new Map(os.map((o) => [o.id, o.name]));
  let sent = 0, counted = 0;
  for (const p of people) {
    const mine = due.filter((t) => t.assigneeId === p.id).sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));
    if (!mine.length) continue;
    const over = mine.filter((t) => t.dueOn! < today).length;
    const items = mine.map((t) => `<b>${esc(t.title)}</b>${t.dealId ? ` · ${esc(dn.get(t.dealId) ?? "")}` : ""}${t.officeId ? ` · ${esc(on.get(t.officeId) ?? "")}` : ""} · <span style="color:${t.dueOn! < today ? "#c0392b" : "#6b7590"}">${t.dueOn! < today ? "overdue since" : "due"} ${esc(t.dueOn)}</span>`);
    const subject = `${mine.length} desk ${mine.length === 1 ? "task" : "tasks"} for today${over ? ` (${over} overdue)` : ""}`;
    if (emailReady()) {
      const html = layout(E.h(subject) + E.p(`Good morning ${esc(p.name.split(" ")[0])}. These are yours on the desk:`) + E.list(items) + E.btn("Open your tasks", "/admin/tasks"),
        { preheader: mine.map((t) => t.title).join(" · ").slice(0, 120), campaign: { medium: "desk", campaign: "tasks" } });
      await sendRaw([p.email], subject, html, [], undefined, { kind: "desk-tasks", userId: p.id }).catch(() => null);
      sent++;
    }
    await db.update(tasks).set({ remindedOn: today }).where(inArray(tasks.id, mine.map((t) => t.id)));
    counted += mine.length;
  }
  return { people: sent, tasks: counted };
}
