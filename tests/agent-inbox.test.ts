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

test("a room draft fills only empty fields of a deal still in preparation", async () => {
  const db = await getDb();
  const room = { lede: "Kept as written", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [], interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] };
  const [d] = await db.insert(deals).values({ slug: `prep-test-${Date.now()}`, company: "Quillon Prep Test Castings Ltd", title: "Castings", category: "Pre-IPO primary", headline: "", listingLabel: "To be set", phase: "preparing", pipelineStage: "sourced", room }).returning({ id: deals.id });
  const prep = await deskAction({ action: "prep" }) as { deals: { company: string; roomEmpty?: { lede: boolean; why: boolean } }[] };
  const row = prep.deals.find((x) => x.company.startsWith("Quillon"));
  assert.deepEqual([row?.roomEmpty?.lede, row?.roomEmpty?.why], [false, true]);
  const r = await deskAction({ action: "room_draft", company: "Quillon Prep Test", lede: "Overwrite attempt", why: "Profitable and growing.", snapshot: [{ k: "Revenue FY26", v: "₹210 Cr" }, { k: "", v: "x" }] });
  assert.deepEqual(r.filled, ["why", "snapshot"]);
  const [after] = await db.select().from(deals).where(eq(deals.id, d.id));
  assert.equal(after.room.lede, "Kept as written");
  assert.equal(after.room.snapshot.length, 1);
  await db.update(deals).set({ phase: "announced" }).where(eq(deals.id, d.id));
  assert.ok((await deskAction({ action: "room_draft", company: "Quillon Prep Test", round: "₹30 Cr" })).error);
  assert.ok((await deskAction({ action: "file", company: "Quillon Prep Test", title: "Drive folder", url: "javascript:alert(1)" })).error);
  assert.equal((await deskAction({ action: "file", company: "Quillon Prep Test", title: "Drive folder", url: "https://drive.google.com/drive/folders/x" })).ok, true);
  await db.update(deals).set({ phase: "preparing", pipelineStage: "archived" }).where(eq(deals.id, d.id));
});

test("the onboarding, listed and compliance reads answer and carry no PAN or contact details", async () => {
  const o = await deskAction({ action: "offices_new" }) as { offices: unknown[]; openDeals: unknown[] };
  assert.ok(Array.isArray(o.offices) && Array.isArray(o.openDeals));
  const text = JSON.stringify(o);
  for (const k of ["pan", "contactEmail", "contactPhone", "passwordHash"]) assert.equal(text.includes(`"${k}"`), false, k);
  const l = await deskAction({ action: "listed" }) as { deals: unknown[] };
  assert.ok(Array.isArray(l.deals));
  const c = await deskAction({ action: "compliance" }) as { gaps: unknown[]; allocationsMoving: number };
  assert.ok(Array.isArray(c.gaps));
  assert.equal(typeof c.allocationsMoving, "number");
  assert.ok((await deskAction({ action: "office_note", office: "No Such Office Anywhere", body: "A note that goes nowhere." })).error);
});

test("a new deal from the assistant lands in preparation and is not added twice", async () => {
  const a = await deskAction({ action: "deal_new", company: "Orrery Test Loyalty Private Limited", sector: "Loyalty software", category: "SME IPO-bound" });
  assert.equal(a.ok, true);
  const db = await getDb();
  const [d] = await db.select().from(deals).where(eq(deals.id, a.id as number));
  assert.deepEqual([d.phase, d.pipelineStage, d.listed, d.debt, d.category], ["preparing", "sourced", false, false, "SME IPO-bound"]);
  assert.equal((await deskAction({ action: "deal_new", company: "ORRERY TEST LOYALTY PVT LTD" })).exists, true);
  await db.update(deals).set({ pipelineStage: "archived" }).where(eq(deals.id, d.id));
});
