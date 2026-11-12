// Holdings outside the desk and followed companies: reading a broker's file, matching names to the IPO calendar,
// lock-ins, totals at the office's own prices, and the once-per-stage alerts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, offices, watches } from "@/db/schema";
import { IPO_DATA, phase, type Ipo } from "@/lib/ipo-calendar";
import { csvRows, findIssue, lockInEnds, newStages, normName, readHoldings, totals, worth } from "@/lib/outside";
import { runWatchAlerts } from "@/lib/watch-alerts";

const ipo = (o: Partial<Ipo>): Ipo => ({ name: "Acme Industries", board: "Mainboard", open: "2026-11-10", close: "2026-11-12", allotment: "2026-11-13", listing: "2026-11-17", ...o });

test("names match without legal endings, case or punctuation", () => {
  assert.equal(normName("Acme Industries Pvt. Ltd."), normName("ACME INDUSTRIES LIMITED"));
  const e = [ipo({ name: "Acme Industries" }), ipo({ name: "Beta Foods" })];
  assert.equal(findIssue("acme industries limited", e)?.name, "Acme Industries");
  assert.equal(findIssue("Beta Foods India Pvt Ltd", e)?.name, "Beta Foods");
  assert.equal(findIssue("Gamma", e), null);
  assert.equal(findIssue("Ac", e), null, "too short to match");
});

test("lock-in: six months on the main board, a year on SME, month ends clamp", () => {
  assert.equal(lockInEnds(ipo({ allotment: "2026-11-13" })), "2027-05-13");
  assert.equal(lockInEnds(ipo({ board: "SME", allotment: "2026-11-13" })), "2027-11-13");
  assert.equal(lockInEnds(ipo({ allotment: "2026-08-31" })), "2027-02-28");
  assert.equal(lockInEnds(ipo({ allotment: undefined, listing: undefined })), null);
});

test("worth is at the office's own price, or at cost when it gave none", () => {
  assert.deepEqual(worth({ shares: 100, costPerShare: 50, valuePerShare: 75 }), { cost: 5000, value: 7500, valued: true, change: 0.5 });
  assert.deepEqual(worth({ shares: 100, costPerShare: 50, valuePerShare: null }), { cost: 5000, value: 5000, valued: false, change: null });
  const t = totals([{ id: 1, kind: "unlisted", company: "A", symbol: null, shares: 10, costPerShare: 10, valuePerShare: 20, valuedOn: null, boughtOn: null, source: "manual" },
    { id: 2, kind: "unlisted", company: "B", symbol: null, shares: 10, costPerShare: 10, valuePerShare: null, valuedOn: null, boughtOn: null, source: "manual" }]);
  assert.equal(t.cost, 200); assert.equal(t.value, 300); assert.equal(t.unvalued, 1);
});

test("a broker's holdings file is read wherever its header sits; totals and blanks are skipped", () => {
  const csv = `Client ID,AB1234\n\nInstrument,Qty.,Avg. cost,LTP,Cur. val\n"RELIANCE",10,"2,400.50",2900,29000\nINFY,5,1500,,8000\nTotal,15,,,37000\nBLANK,0,10,10,0\n`;
  const r = readHoldings(csvRows(csv));
  assert.equal(r.error, undefined);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows[0], { company: "RELIANCE", symbol: null, isin: null, shares: 10, costPerShare: 2400.5, valuePerShare: 2900 });
  assert.equal(r.rows[1].valuePerShare, 1600, "value ÷ quantity when there is no LTP");
  assert.equal(r.skipped, 2);
  assert.ok(readHoldings([["foo", "bar"], ["1", "2"]]).error, "no usable columns");
  assert.deepEqual(csvRows("a;b\n1;2"), [["a", "b"], ["1", "2"]], "semicolons");
});

test("each stage is told once; a company followed late is told only where it stands", () => {
  const i = ipo({});
  assert.deepEqual(newStages(i, [], "2026-11-01"), ["soon"]);
  assert.deepEqual(newStages(i, ["soon"], "2026-11-11"), ["open"]);
  assert.deepEqual(newStages(i, ["soon", "open"], "2026-11-11"), []);
  assert.deepEqual(newStages(i, [], "2026-11-20"), ["listed"], "no history for a late follow");
  assert.deepEqual(newStages(i, ["soon"], "2026-11-20"), ["open", "closed", "listed"]);
});

test("the daily run notifies the office once per new stage and records it", async () => {
  const e = IPO_DATA.entries[0];
  if (!e) return;
  const db = await getDb();
  const [o] = await db.insert(offices).values({ name: `Watcher ${Date.now()}`, approval: "approved" }).returning();
  const [w] = await db.insert(watches).values({ officeId: o.id, name: e.name, norm: normName(e.name) }).returning();
  await assert.rejects(db.insert(watches).values({ officeId: o.id, name: e.name.toUpperCase(), norm: normName(e.name) }), "one follow per company per office");
  await runWatchAlerts();
  const [after] = await db.select().from(watches).where(eq(watches.id, w.id));
  assert.ok(after.told.includes(phase(e, new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10))));
  const n1 = await db.select().from(notifications).where(eq(notifications.officeId, o.id));
  assert.equal(n1.length, 1, JSON.stringify(n1.map((n) => n.title)) + JSON.stringify(after.told));
  await runWatchAlerts();
  assert.equal((await db.select().from(notifications).where(eq(notifications.officeId, o.id))).length, 1, "not told twice");
});
