// After the Bell: a listed company must never reach an investor-facing surface.
// Runs the real deal-reading code against an in-memory Postgres with the real migrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals } from "@/db/schema";
import { listDeals, listUpcoming, getDeal, publicData } from "@/lib/deals";
import { investorWhere, investorVisible } from "@/lib/deal-guard";

const SECRET = "Zeta Listed Secret Industries Ltd";
const room = { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [],
  interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] };
// drizzle wraps the driver error; the constraint name is on the cause.
const CHECK = (e: unknown) => /deals_listed_desk_only|check constraint/i.test(`${e} ${(e as { cause?: unknown })?.cause ?? ""}`);
const base = { company: SECRET, title: "Listed company", category: "Block deal", stage: "Desk only", status: "desk", headline: "", listingLabel: "NSE: ZETA", room };

test("listed deals are refused publication by the database", async () => {
  const db = await getDb();
  await assert.rejects(db.insert(deals).values({ ...base, slug: "atb-pub", listed: true, published: true, open: false, preview: false }), CHECK);
  await assert.rejects(db.insert(deals).values({ ...base, slug: "atb-open", listed: true, published: false, open: true, preview: false }), CHECK);
  await assert.rejects(db.insert(deals).values({ ...base, slug: "atb-prev", listed: true, published: false, open: false, preview: true }), CHECK);
  const [row] = await db.insert(deals).values({ ...base, slug: "atb-ok", listed: true, published: false, open: false, preview: false }).returning({ id: deals.id });
  await assert.rejects(db.update(deals).set({ published: true }).where(eq(deals.id, row.id)), CHECK);
});

test("investor-facing deal reads never return a listed company", async () => {
  const db = await getDb();
  const [row] = await db.select().from(deals).where(eq(deals.slug, "atb-ok"));
  assert.ok(row && row.listed, "the listed deal exists for the desk");
  const seeded = await listDeals(true);
  assert.ok(seeded.length > 0, "the seeded pre-IPO deals are still listed");
  for (const list of [await listDeals(true), await listDeals(false), await listUpcoming()]) {
    assert.equal(list.some((d) => d.id === row.id || d.company === SECRET), false);
    assert.equal(JSON.stringify(publicData(list)).includes(SECRET), false);
  }
  assert.equal(await getDeal("atb-ok"), null);
  assert.equal((await db.select().from(deals).where(investorWhere(eq(deals.id, row.id)))).length, 0);
  assert.equal(investorVisible(row), false);
});

test("the sitemap and llms.txt leave listed companies out", async () => {
  const sitemap = (await import("@/app/sitemap")).default;
  const entries = await sitemap();
  assert.equal(JSON.stringify(entries).includes("atb-ok"), false);
  const { GET } = await import("@/app/llms.txt/route");
  const text = await (await GET()).text();
  assert.equal(text.includes(SECRET) || text.includes("atb-ok"), false);
});
