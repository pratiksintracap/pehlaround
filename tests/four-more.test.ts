// IPO-only issues stay off the shelf; interest a partner enters counts only once the client confirms; sellers are
// matched to offices from their profiles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, ipoBids, offices, users } from "@/db/schema";
import { AWAITING, counts, ipoVisible } from "@/lib/ipo";
import { answerProposal, proposalByToken } from "@/lib/ipo-proposal";
import { listDeals } from "@/lib/deals";
import { matchSeller, normCompany } from "@/lib/seller-match";

const room = { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [], interest: { min: 0.5, max: 10, step: 0.5, def: 1, note: "" }, alerts: [], passReasons: [] };
const day = (n: number) => new Date(Date.now() + 5.5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

test("an IPO-only issue can never leave preparation, is off the shelf, and shows as an issue once the prospectus is filed", async () => {
  const db = await getDb();
  const [d] = await db.insert(deals).values({ slug: `only-${Date.now()}`, company: "Only IPO Ltd", title: "Maker", category: "IPO", headline: "", listingLabel: "To be set", ipoOnly: true, room, ipo: {} }).returning();
  await assert.rejects(db.update(deals).set({ phase: "open" }).where(eq(deals.id, d.id)), "the database refuses to put it on the shelf");
  assert.equal((await listDeals()).some((x) => x.id === d.id), false, "not on the shelf");
  assert.equal(ipoVisible(await listDeals(true)).some((x) => x.id === d.id), false, "not an issue before the prospectus");
  await db.update(deals).set({ ipo: { rhp: day(0), closes: day(3) } }).where(eq(deals.id, d.id));
  const fresh = await db.select().from(deals).where(eq(deals.id, d.id));
  assert.equal(ipoVisible(fresh).length, 1, "an issue once the price band has a date");
  assert.equal(ipoVisible([{ published: false, ipoOnly: false, ipo: { rhp: day(0) } }]).length, 0, "an ordinary deal in preparation is never shown");
});

test("interest a partner enters counts only after the client confirms; the link works once", async () => {
  const db = await getDb();
  const [d] = await db.insert(deals).values({ slug: `prop-${Date.now()}`, company: "Proposal Ltd", title: "Maker", category: "IPO", headline: "", listingLabel: "To be set", ipoOnly: true, room, ipo: { rhp: day(0), closes: day(3) } }).returning();
  const [firm] = await db.insert(offices).values({ name: "Firm", investorType: "broker", approval: "approved" }).returning();
  const [client] = await db.insert(offices).values({ name: "Client FO", approval: "approved", referredBy: firm.id }).returning();
  const [other] = await db.insert(offices).values({ name: "Other FO", approval: "approved" }).returning();
  const mk = async (email: string, officeId: number) => (await db.insert(users).values({ email: `${Date.now()}${email}`, name: email, officeId, passwordHash: "x" }).returning())[0];
  const rm = await mk("rm@f.test", firm.id), cu = await mk("c@c.test", client.id), ou = await mk("o@o.test", other.id);
  const token = "tok_" + "a".repeat(28) + Date.now();
  const [b] = await db.insert(ipoBids).values({ dealId: d.id, officeId: client.id, userId: cu.id, category: "hni", amountCr: "0.25", status: AWAITING, proposedByUserId: rm.id, proposedByOfficeId: firm.id, confirmToken: token }).returning();
  assert.equal(counts(b), false, "awaiting the client: counts nowhere");
  assert.equal((await proposalByToken(token))?.id, b.id);
  assert.equal(await proposalByToken("nope"), null);
  assert.equal((await answerProposal(b.id, true, ou)).ok, false, "another office cannot answer it");
  const r = await answerProposal(b.id, true, null);
  assert.equal(r.ok, true);
  const [after] = await db.select().from(ipoBids).where(eq(ipoBids.id, b.id));
  assert.equal(after.status, "Indicated"); assert.equal(after.confirmToken, null); assert.ok(after.confirmedAt); assert.equal(counts(after), true);
  assert.equal(await proposalByToken(token), null, "the link works once");
  assert.equal((await answerProposal(b.id, false, cu)).ok, false, "already answered");
});

test("sellers are matched from what offices told the desk; partner firms are never buyers", () => {
  const o = (id: number, x: Partial<{ investorType: string; ticket: string; sectors: string[]; structures: string[] }>) => ({ id, name: `O${id}`, investorType: "family_office", ticket: null, sectors: [], structures: [], ...x });
  const offices = [o(1, { structures: ["Pre-IPO secondary"], sectors: ["Agri and food"], ticket: "₹1–2 crore" }), o(2, { structures: ["Pre-IPO primary"], ticket: "Above ₹25 crore" }), o(3, { investorType: "broker", structures: ["Pre-IPO secondary"] }), o(4, {}), o(5, { ticket: "₹2–5 crore" })];
  const m = matchSeller({ company: "Acme", size: "₹1–5 Cr", sector: "Agri and food" }, offices, new Set([4]));
  assert.deepEqual(m.map((x) => x.officeId), [1, 4, 5], "best fit first; the broker and the too-large ticket are out");
  assert.ok(m[0].why.some((w) => /secondaries/.test(w)) && m[1].why.some((w) => /Already in/.test(w)));
  assert.equal(normCompany("Acme Industries Pvt. Ltd."), normCompany("ACME Industries Limited"));
});
