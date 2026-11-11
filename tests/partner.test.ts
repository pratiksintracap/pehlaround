// Partner firms: a principal sees every client of the firm, a relationship manager only the ones they introduced;
// progress against the desk's target counts NDAs signed and amounts requested; a person's code credits them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices, users } from "@/db/schema";
import { isPartnerAdmin, visibleClients, tally, progress, type Client } from "@/lib/partner-math";
import { referrerByCode, userRefCode, officeRefCode } from "@/lib/track";

const firm = { investorType: "broker" };
const principal = { id: 1, rights: "View, comment, commit", officeId: 9, office: firm };
const rm = { id: 2, rights: "View", officeId: 9, office: firm };
const mk = (id: number, rmId: number | null, approval = "approved"): Client => ({ id, name: `C${id}`, approval, createdAt: new Date(), rmId });
const clients = [mk(10, 2), mk(11, 3), mk(12, null, "pending")];

test("a principal sees the whole firm; a relationship manager only their own clients", () => {
  assert.equal(isPartnerAdmin(principal), true);
  assert.equal(isPartnerAdmin(rm), false);
  assert.equal(isPartnerAdmin({ ...principal, office: { investorType: "family_office" } }), false);
  assert.deepEqual(visibleClients(principal, clients).map((c) => c.id), [10, 11, 12]);
  assert.deepEqual(visibleClients(rm, clients).map((c) => c.id), [10]);
});

test("tally counts introductions per client per company and leaves out withdrawn requests", () => {
  const ndas = [{ officeId: 10, dealId: 1, signedAt: new Date() }, { officeId: 10, dealId: 2, signedAt: new Date() }, { officeId: 11, dealId: 1, signedAt: new Date() }, { officeId: 99, dealId: 1, signedAt: new Date() }];
  const asks = [{ officeId: 10, dealId: 1, amountCr: "0.5", status: "Indicated" }, { officeId: 11, dealId: 1, amountCr: "1", status: "Allotted" }, { officeId: 11, dealId: 1, amountCr: "3", status: "Withdrawn" }, { officeId: 99, dealId: 1, amountCr: "9", status: "Indicated" }];
  assert.deepEqual(tally(clients, ndas, asks), { clients: 3, approved: 2, intros: 3, indicatedCr: 1.5, allottedCr: 1 });
  assert.deepEqual(tally(clients, ndas, asks, 1), { clients: 3, approved: 2, intros: 2, indicatedCr: 1.5, allottedCr: 1 });
  assert.equal(tally(visibleClients(rm, clients), ndas, asks, 1).indicatedCr, 0.5);
});

test("progress is the better of introductions and amount, capped at the target", () => {
  assert.equal(progress(undefined, { intros: 3, indicatedCr: 1 }), null);
  assert.equal(progress({ intros: 4, amountCr: null }, { intros: 1, indicatedCr: 0 }), 0.25);
  assert.equal(progress({ intros: 4, amountCr: 2 }, { intros: 1, indicatedCr: 1.5 }), 0.75);
  assert.equal(progress({ intros: 2, amountCr: null }, { intros: 5, indicatedCr: 0 }), 1);
});

test("a person's invite code credits them; the firm's code credits the firm", async () => {
  const db = await getDb();
  const [o] = await db.insert(offices).values({ name: "Test Wealth", investorType: "broker", approval: "approved" }).returning({ id: offices.id });
  const [u] = await db.insert(users).values({ email: `rm${Date.now()}@wealth.test`, name: "RM One", officeId: o.id, rights: "View", passwordHash: "x" }).returning({ id: users.id });
  const mine = await userRefCode(u.id), firmCode = await officeRefCode(o.id);
  assert.ok(mine && firmCode && mine !== firmCode && mine.length === 9);
  assert.equal(await userRefCode(u.id, mine), mine, "kept once made");
  const a = await referrerByCode(mine), b = await referrerByCode(firmCode);
  assert.equal(a?.id, o.id); assert.equal(a?.rmId, u.id);
  assert.equal(b?.id, o.id); assert.equal(b?.rmId, null);
  await db.update(users).set({ disabled: true }).where(eq(users.id, u.id));
  assert.equal(await referrerByCode(mine), null, "a disabled person's link stops working");
});
