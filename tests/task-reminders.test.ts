// The 9 AM run reminds each assignee of open tasks due today or earlier, once a day.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks, users } from "@/db/schema";
import { runTaskReminders } from "@/lib/task-reminders";
import { istDay } from "@/lib/stages";

test("due and overdue tasks are counted once a day; future and done tasks are not", async () => {
  const db = await getDb();
  const [u] = await db.insert(users).values({ email: `analyst${Date.now()}@desk.test`, name: "Test Analyst", role: "analyst", passwordHash: "x" }).returning({ id: users.id });
  const now = new Date("2026-10-21T04:00:00Z"); // 9:30 AM IST
  const today = istDay(now), yesterday = istDay(new Date(+now - 864e5)), tomorrow = istDay(new Date(+now + 864e5));
  await db.insert(tasks).values([
    { title: "overdue", assigneeId: u.id, dueOn: yesterday }, { title: "today", assigneeId: u.id, dueOn: today },
    { title: "tomorrow", assigneeId: u.id, dueOn: tomorrow }, { title: "finished", assigneeId: u.id, dueOn: yesterday, status: "done" },
  ]);
  const first = await runTaskReminders(now);
  assert.equal(first.tasks, 2);
  const again = await runTaskReminders(now);
  assert.equal(again.tasks, 0, "a second run the same day sends nothing new");
  const rows = await db.select().from(tasks).where(eq(tasks.assigneeId, u.id));
  assert.deepEqual(rows.filter((t) => t.remindedOn === today).map((t) => t.title).sort(), ["overdue", "today"]);
});
