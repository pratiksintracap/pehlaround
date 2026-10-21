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
