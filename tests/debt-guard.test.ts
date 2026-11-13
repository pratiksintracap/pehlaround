// Debt deals: desk-only like listed ones. The database refuses to publish one, and no investor-facing read returns it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals } from "@/db/schema";
import { listDeals, listUpcoming, getDeal, publicData } from "@/lib/deals";
import { investorWhere, investorVisible } from "@/lib/deal-guard";
import { deskDeals } from "@/lib/desk";
import { dealHref, dealKind } from "@/lib/stages";

const SECRET = "Omega Debt Secret Finance Ltd";
const room = { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [],
  interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] };
const CHECK = (e: unknown) => /deals_debt_desk_only|check constraint/i.test(`${e} ${(e as { cause?: unknown })?.cause ?? ""}`);
const base = { company: SECRET, title: "NBFC", category: "Term loan", headline: "", listingLabel: "Debt", room };

test("debt deals are refused publication by the database", async () => {
  const db = await getDb();
  await assert.rejects(db.insert(deals).values({ ...base, slug: "debt-pub", debt: true, phase: "announced" }), CHECK);
  await assert.rejects(db.insert(deals).values({ ...base, slug: "debt-open", debt: true, phase: "open" }), CHECK);
  const [row] = await db.insert(deals).values({ ...base, slug: "debt-ok", debt: true, phase: "preparing", debtInfo: { facility: "Term loan", amountCr: 25 } }).returning({ id: deals.id });
  await assert.rejects(db.update(deals).set({ phase: "coming" }).where(eq(deals.id, row.id)), CHECK);
});

test("investor-facing reads never return a debt deal; the desk sees it in its own list", async () => {
  const db = await getDb();
  const [row] = await db.select().from(deals).where(eq(deals.slug, "debt-ok"));
  for (const list of [await listDeals(true), await listDeals(false), await listUpcoming()]) {
    assert.equal(list.some((d) => d.id === row.id), false);
    assert.equal(JSON.stringify(publicData(list)).includes(SECRET), false);
  }
  assert.equal(await getDeal("debt-ok"), null);
  assert.equal((await db.select().from(deals).where(investorWhere(eq(deals.id, row.id)))).length, 0);
  assert.equal(investorVisible(row), false);
  assert.ok((await deskDeals({ kind: "debt" })).some((d) => d.id === row.id));
  assert.equal((await deskDeals({ kind: "equity" })).some((d) => d.id === row.id), false);
  assert.equal(dealHref(row), `/admin/debt/${row.id}`);
  assert.equal(dealKind(row), "debt");
});
