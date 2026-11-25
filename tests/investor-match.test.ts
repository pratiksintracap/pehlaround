// Who to pitch: investors ranked by what they told us and what they did; those who passed on the deal are left out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, offices, passes, users, dealViews } from "@/db/schema";
import { dealSectors, matchInvestors } from "@/lib/investor-match";

test("investors are ranked by sector, ticket and activity, and a pass on the deal leaves them out", async () => {
  const db = await getDb();
  const t = Date.now().toString(36);
  const [d] = await db.insert(deals).values({ slug: `match-${t}`, company: `Match Test Logistics ${t}`, title: "Warehousing and logistics", category: "Pre-IPO primary", headline: "Cold-chain warehousing", listingLabel: "2028", phase: "preparing", roundCr: 20, sort: 900,
    room: { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [], interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] } }).returning({ id: deals.id, title: deals.title, category: deals.category, headline: deals.headline, roundCr: deals.roundCr });
  assert.deepEqual(dealSectors(d), ["Logistics and infrastructure"]);
  const os = await db.insert(offices).values([
    { name: `Fit Office ${t}`, approval: "approved", sectors: ["Logistics and infrastructure"], ticket: "₹2–5 crore", structures: ["Pre-IPO primary"] },
    { name: `Other Sector ${t}`, approval: "approved", sectors: ["Healthcare and pharma"], ticket: "₹2–5 crore" },
    { name: `Passed Office ${t}`, approval: "approved", sectors: ["Logistics and infrastructure"], ticket: "₹5–25 crore" },
  ]).returning({ id: offices.id, name: offices.name });
  const [u] = await db.insert(users).values({ email: `match-${t}@test.in`, name: "Match Tester", passwordHash: "x", officeId: os[2].id }).returning({ id: users.id });
  await db.insert(passes).values({ dealId: d.id, officeId: os[2].id, userId: u.id, reason: "Valuation" });
  await db.insert(dealViews).values([{ dealId: d.id, officeId: os[0].id }, { dealId: d.id, officeId: os[0].id }]);
  const m = await matchInvestors({ ...d, id: d.id }, 50);
  const names = m.map((x) => x.name);
  assert.ok(names.indexOf(`Fit Office ${t}`) >= 0);
  assert.equal(names.includes(`Passed Office ${t}`), false);
  const fitRow = m.find((x) => x.name === `Fit Office ${t}`)!;
  assert.ok(fitRow.reasons.some((r) => /logistics/i.test(r)));
  assert.ok(fitRow.reasons.some((r) => /Viewed this deal 2×/.test(r)));
  const other = m.find((x) => x.name === `Other Sector ${t}`);
  assert.ok(!other || other.score < fitRow.score);
  assert.deepEqual(await matchInvestors({ ...d, debt: true }), []);
  await db.update(offices).set({ approval: "rejected" }).where(inArray(offices.id, os.map((o) => o.id)));
  await db.update(deals).set({ pipelineStage: "archived" }).where(eq(deals.id, d.id));
});
