// Private credit: the database keeps each lender to its own rows, whatever the application code asks for.
// Every credit query runs as the restricted role credit_app with row-level security (drizzle/0050_private_credit.sql).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { withContext } from "@/lib/credit/db";
import { blobs, borrowers, dealShares, lenders, raises, raiseEconomics } from "@/lib/credit/schema";
import { getObject, putObject } from "@/lib/credit/server/storage";

const admin = { role: "admin" as const, userId: "" };
let A = "", B = "", raiseId = "";

test("setup: two lenders, one raise shared only with the first", async () => {
  await getDb();
  await withContext(admin, async (tx) => {
    [{ id: A }] = await tx.insert(lenders).values({ name: "Lender A" }).returning({ id: lenders.id });
    [{ id: B }] = await tx.insert(lenders).values({ name: "Lender B" }).returning({ id: lenders.id });
    const [b] = await tx.insert(borrowers).values({ name: "Secret Borrower NBFC" }).returning({ id: borrowers.id });
    [{ id: raiseId }] = await tx.insert(raises).values({ borrowerId: b.id, cycleStart: "2026-11-01", cycle: "yearly", amount: "100000000", status: "open" }).returning({ id: raises.id });
    await tx.insert(raiseEconomics).values({ raiseId, borrowerRate: "15" });
    await tx.insert(dealShares).values({ raiseId, lenderId: A });
  });
});

test("a lender sees only raises shared with it, and only its own organisation", async () => {
  const seen = (lenderId: string) => withContext({ role: "lender", userId: "", lenderId }, async (tx) => ({
    raises: (await tx.select().from(raises)).length,
    borrowers: (await tx.select().from(borrowers)).map((r) => r.name),
    lenders: (await tx.select().from(lenders)).map((r) => r.name),
    economics: (await tx.select().from(raiseEconomics)).length,
  }));
  const a = await seen(A);
  assert.equal(a.raises, 1);
  assert.deepEqual(a.borrowers, ["Secret Borrower NBFC"]);
  assert.deepEqual(a.lenders, ["Lender A"]);
  assert.equal(a.economics, 0, "the platform's economics are never visible to a lender");
  const b = await seen(B);
  assert.equal(b.raises, 0);
  assert.deepEqual(b.borrowers, []);
  assert.deepEqual(b.lenders, ["Lender B"]);
});

test("a lender cannot write, and no context sees nothing", async () => {
  await assert.rejects(withContext({ role: "lender", userId: "", lenderId: A }, (tx) => tx.insert(lenders).values({ name: "Injected" })));
  const none = await withContext({ role: "auth" }, async (tx) => (await tx.select().from(raises)).length);
  assert.equal(none, 0);
});

test("the credit role cannot read Before the Bell's own tables or the file store", async () => {
  await assert.rejects(withContext(admin, (tx) => tx.execute(sql`select count(*) from users`)));
  await assert.rejects(withContext(admin, (tx) => tx.execute(sql`select count(*) from deals`)));
  const { key } = await putObject(Buffer.from("%PDF-1.4 test"));
  const visible = await withContext(admin, async (tx) => (await tx.select().from(blobs)).length);
  assert.equal(visible, 0);
  assert.equal((await getObject(key)).toString(), "%PDF-1.4 test");
});
