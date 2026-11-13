// The assistant's inbox: it reads what is waiting on the desk and writes only drafts and desk-only notes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, questions } from "@/db/schema";
import { deskAction } from "@/lib/agent-desk";
import { notListed } from "@/lib/deal-guard";

test("a drafted answer is saved as a draft and never posted", async () => {
  const db = await getDb();
  const [d] = await db.select({ id: deals.id, company: deals.company }).from(deals).where(notListed).limit(1);
  const [q] = await db.insert(questions).values({ dealId: d.id, question: "What is the order book today?" }).returning({ id: questions.id });
  const inbox = await deskAction({ action: "inbox" }) as { questions: { id: number; company: string }[]; rooms: { company: string }[] };
  assert.ok(inbox.questions.some((x) => x.id === q.id && x.company === d.company));
  assert.ok(inbox.rooms.some((r) => r.company === d.company));
  assert.equal(JSON.stringify(inbox).includes("officeId"), false);
  const r = await deskAction({ action: "draft_answer", id: q.id, answer: "The room's snapshot gives the order book as of the last update." });
  assert.equal(r.ok, true);
  const [after] = await db.select().from(questions).where(eq(questions.id, q.id));
  assert.equal(after.answer, null);
  assert.equal(after.answeredAt, null);
  assert.equal(after.draftBy, "Claude (assistant)");
  // A promoter's own draft is never overwritten.
  await db.update(questions).set({ draftAnswer: "From the promoter", draftBy: null }).where(eq(questions.id, q.id));
  const again = await deskAction({ action: "draft_answer", id: q.id, answer: "Another attempt at the same question." });
  assert.ok(again.skipped);
  await db.delete(questions).where(eq(questions.id, q.id));
});

test("the debt book and the scorecard answer; a note needs one deal", async () => {
  const debt = await deskAction({ action: "debt" }) as { deals: unknown[] };
  assert.ok(Array.isArray(debt.deals));
  const sc = await deskAction({ action: "scorecard" }) as { pipeline: { active: number }; tasks: { overdue: number } };
  assert.equal(typeof sc.pipeline.active, "number");
  assert.equal(typeof sc.tasks.overdue, "number");
  assert.ok((await deskAction({ action: "note", company: "no such company anywhere", body: "A note that goes nowhere." })).error);
});
