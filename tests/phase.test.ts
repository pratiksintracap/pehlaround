// The deal lifecycle (MODEL.md §3): `phase` is the only field written; the database derives the old flags from it,
// and each phase puts the deal on exactly the investor surfaces the model says.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals } from "@/db/schema";
import { listDeals, listUpcoming } from "@/lib/deals";
import { PHASES, PHASE_SQL, isPhase, isPublic, roomOpen, phaseInfo } from "@/lib/phase";

const room = { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [],
  interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] };

test("phase helpers", () => {
  assert.deepEqual(PHASES.map((p) => p.id), ["preparing", "coming", "announced", "open", "closed"]);
  assert.ok(isPhase("open") && !isPhase("live") && !isPhase(undefined));
  assert.deepEqual(PHASES.filter((p) => isPublic(p.id)).map((p) => p.id), ["announced", "open", "closed"]);
  assert.deepEqual(PHASES.filter((p) => roomOpen(p.id)).map((p) => p.id), ["open"]);
  assert.equal(phaseInfo("nonsense").id, "preparing");
  for (const p of PHASES) assert.ok(!/'/.test(p.tag + p.status), "tags go into SQL literals");
  assert.match(PHASE_SQL.stage, /WHEN 'closed' THEN 'Round closed'/);
});

test("the database derives the flags from phase, and they cannot be written", async () => {
  const db = await getDb();
  const [row] = await db.insert(deals).values({ slug: "ph-test", company: "Phase Test Pvt Ltd", title: "Phase test", category: "Pre-IPO primary", headline: "", listingLabel: "FY28", room })
    .returning({ id: deals.id, phase: deals.phase, published: deals.published });
  assert.equal(row.phase, "preparing");
  assert.equal(row.published, false);
  const expect = {
    preparing: { published: false, open: false, preview: false, list: false, upcoming: false },
    coming: { published: false, open: false, preview: true, list: false, upcoming: true },
    announced: { published: true, open: false, preview: false, list: true, upcoming: false },
    open: { published: true, open: true, preview: false, list: true, upcoming: false },
    closed: { published: true, open: false, preview: false, list: true, upcoming: false },
  } as const;
  for (const p of PHASES) {
    await db.update(deals).set({ phase: p.id }).where(eq(deals.id, row.id));
    const [d] = await db.select().from(deals).where(eq(deals.id, row.id));
    const e = expect[p.id];
    assert.equal(d.published, e.published, `${p.id} published`);
    assert.equal(d.open, e.open, `${p.id} open`);
    assert.equal(d.preview, e.preview, `${p.id} preview`);
    assert.equal(d.stage, p.tag, `${p.id} tag`);
    assert.equal(d.status, p.status, `${p.id} status`);
    assert.equal((await listDeals(false)).some((x) => x.id === row.id), e.list, `${p.id} on the shelf`);
    assert.equal((await listUpcoming()).some((x) => x.id === row.id), e.upcoming, `${p.id} coming to the desk`);
    assert.equal((await listDeals(true)).some((x) => x.id === row.id), true, `${p.id} the desk still sees it`);
  }
  // A bad phase is refused by the check constraint.
  await assert.rejects(db.update(deals).set({ phase: "live" as never }).where(eq(deals.id, row.id)));
});
