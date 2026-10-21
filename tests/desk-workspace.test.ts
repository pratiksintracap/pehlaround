// The activity panel on a deal shows that deal's desk changes only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "@/lib/db";
import { audit, deals } from "@/db/schema";
import { workspace } from "@/lib/desk";

test("a deal's trail holds its own desk changes, not other deals or sign-ins", async () => {
  const db = await getDb();
  const [a, b] = await db.select({ id: deals.id }).from(deals).limit(2);
  await db.insert(audit).values([
    { action: "A stage", dealId: a.id, entity: "deal", entityId: a.id, who: "Desk" },
    { action: "B stage", dealId: b.id, entity: "deal", entityId: b.id, who: "Desk" },
    { action: "Signed in", who: "Someone" },
    { action: "Desk changed the site settings", who: "Desk" },
    { action: "Office opened A's room", dealId: a.id, officeId: 1 },
  ]);
  const t = (await workspace(a.id)).trail.map((r) => r.action);
  assert.ok(t.includes("A stage"));
  for (const x of ["B stage", "Signed in", "Desk changed the site settings", "Office opened A's room"]) assert.equal(t.includes(x), false, x);
});

test("a desk change about an office never shows as that office's own activity", async () => {
  const { log } = await import("@/lib/auth");
  const { eq, desc } = await import("drizzle-orm");
  const db = await getDb();
  await log({ id: 1, name: "Desk", officeId: null }, "Desk added a note", null, { entity: "note", entityId: 1, officeId: 777, detail: { note: "internal" } });
  const [row] = await db.select().from(audit).orderBy(desc(audit.id)).limit(1);
  assert.equal(row.officeId, null, "audit.officeId stays empty, so the office's Log tab, export and the pipeline never see it");
  assert.equal(row.detail?.officeId, 777);
  assert.equal((await db.select().from(audit).where(eq(audit.officeId, 777))).length, 0);
});
