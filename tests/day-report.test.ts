// The daily desk report: built from tasks and the trail, split by book, handed over as PDF or text, and logged so the
// cut-off check knows whether the member sent their own report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, deals, settings, tasks, users } from "@/db/schema";
import { istDay } from "@/lib/stages";
import { buildDayReport, cutoffInstant, istBounds, logReportTaken, reportLog, reportPdf, reportText, runDayReportEmails, workingDay } from "@/lib/day-report";

test("the end-of-day report splits done, slipped and new tasks by book", async () => {
  const db = await getDb();
  const [u] = await db.insert(users).values({ email: `report-${Date.now()}@test.in`, name: "Report Tester", role: "analyst", passwordHash: "x" }).returning({ id: users.id, name: users.name });
  const [debt] = await db.insert(deals).values({ slug: `rep-debt-${Date.now()}`, company: "Report Test Debt Co", title: "Debt", category: "Debt", headline: "", listingLabel: "Debt", phase: "preparing", debt: true, sort: 900,
    room: { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [], interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] } }).returning({ id: deals.id });
  const today = istDay(), now = new Date();
  const ids = (await db.insert(tasks).values([
    { title: "Done debt thing", dealId: debt.id, assigneeId: u.id, status: "done", doneAt: now, doneBy: u.name, createdById: u.id, createdBy: u.name, dueOn: today },
    { title: "Slipped general thing", assigneeId: u.id, status: "open", dueOn: "2026-01-02", createdBy: "someone else" },
  ]).returning({ id: tasks.id })).map((t) => t.id);
  await db.insert(audit).values({ userId: u.id, who: u.name, action: "Desk added a note on Report Test Debt Co", dealId: debt.id, entity: "note" });

  const r = (await buildDayReport("end", u.id, today, "Met a lender"))!;
  const book = (k: string) => r.books.find((b) => b.k === k)!.blocks;
  assert.deepEqual(book("debt").map((b) => b.title), ["Done", "New tasks", "Other updates"]);
  assert.equal(book("debt")[0].lines[0].deal, "Report Test Debt Co");
  assert.equal(book("misc")[0].title, "Due, not done");
  assert.match(book("misc")[0].lines[0].extra!, /days late/);
  assert.equal(r.counts.find((c) => c.label === "Done")!.n, 1);

  const text = reportText(r);
  assert.match(text, /\*End of day report · Report Tester/);
  assert.match(text, /\*DEBT\*/);
  assert.match(text, /Note:\* Met a lender/);
  const pdf = await reportPdf(r);
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");

  // Start of day: the slipped task shows as overdue.
  const s = (await buildDayReport("start", u.id, today))!;
  assert.equal(s.books.find((b) => b.k === "misc")!.blocks[0].title, "Overdue");

  // Taking your own report is logged; someone else taking it for you does not count as you sending it.
  const [boss] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "admin")).limit(1);
  await logReportTaken(boss, r, "pdf");
  assert.equal((await reportLog(today, today)).get(`${u.id}|${today}|end`), undefined);
  await logReportTaken(u, r, "text");
  const got = (await reportLog(today, today)).get(`${u.id}|${today}|end`);
  assert.ok(got);
  assert.equal(got!.note, "Met a lender");

  await db.delete(tasks).where(inArray(tasks.id, ids));
  await db.update(deals).set({ pipelineStage: "archived" }).where(eq(deals.id, debt.id));
  await db.update(users).set({ disabled: true }).where(eq(users.id, u.id));
});

test("day bounds, cut-off and working days are in IST", () => {
  assert.equal(istBounds("2026-11-24").start.toISOString(), "2026-11-23T18:30:00.000Z");
  assert.equal(cutoffInstant("2026-11-24", "19:30").toISOString(), "2026-11-24T14:00:00.000Z");
  assert.equal(workingDay("2026-11-24", false), true);    // Tuesday
  assert.equal(workingDay("2026-11-28", false), false);   // Saturday
  assert.equal(workingDay("2026-11-28", true), true);
  assert.equal(workingDay("2026-11-29", true), false);    // Sunday
});

test("the evening run goes once a day and skips weekends", async () => {
  const db = await getDb();
  await db.delete(settings).where(eq(settings.key, "dayReportSent:end"));
  const sunday = new Date("2026-11-29T14:00:00Z");
  assert.deepEqual(await runDayReportEmails("end", sunday), { skipped: "not a working day" });
  const tuesday = new Date("2026-11-24T14:00:00Z");
  const first = await runDayReportEmails("end", tuesday) as { skipped?: string };
  if (!first.skipped) assert.deepEqual(await runDayReportEmails("end", tuesday), { skipped: "already sent today" });
  await db.delete(settings).where(eq(settings.key, "dayReportSent:end"));
});

test("sign-ins and page loads are not counted as updates", async () => {
  const db = await getDb();
  const [u] = await db.insert(users).values({ email: `noise-${Date.now()}@test.in`, name: "Noise Tester", role: "analyst", passwordHash: "x" }).returning({ id: users.id });
  await db.insert(audit).values([{ userId: u.id, who: "Noise Tester", action: "Signed in" }, { userId: u.id, who: "Noise Tester", action: "Desk loaded the console" }, { userId: u.id, who: "Noise Tester", action: "Desk updated the deal: X" }]);
  const r = (await buildDayReport("end", u.id))!;
  assert.equal(r.counts.find((c) => c.label === "Updates")!.n, 1);
  await db.update(users).set({ disabled: true }).where(eq(users.id, u.id));
});

test("the one-pager covers the period since the previous one-pager day and renders", async () => {
  const { previousDay, buildOnePager, onePagerPdf, onePagerHtml, runOnePager } = await import("@/lib/onepager");
  assert.equal(previousDay("2026-11-25", [1, 3, 5, 6]), "2026-11-23");   // Wed -> Mon
  assert.equal(previousDay("2026-11-30", [1, 3, 5, 6]), "2026-11-28");   // Mon -> Sat
  const p = await buildOnePager("2026-11-25");
  assert.equal(p.since, "2026-11-23");
  assert.ok(p.numbers.length >= 4 && p.sections.some((s) => s.title === "Needs attention"));
  assert.match(onePagerHtml(p), /Desk one-pager/);
  assert.equal(Buffer.from((await onePagerPdf(p)).slice(0, 5)).toString(), "%PDF-");
  assert.deepEqual(await runOnePager(new Date("2026-11-24T04:00:00Z")), { skipped: "not a one-pager day" });   // a Tuesday
});
