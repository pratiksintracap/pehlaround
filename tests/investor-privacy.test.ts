// Investors added by hand are private to whoever added them; the super admin sees every one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices, users } from "@/db/schema";
import { names, officeScope, canSeeOffice, hiddenOffices } from "@/lib/desk";

test("each analyst sees only the investors they added; the super admin sees all", async () => {
  const db = await getDb();
  const mk = async (name: string, role: string) => (await db.insert(users).values({ email: `${name}${Date.now()}@desk.test`, name, role, passwordHash: "x" }).returning({ id: users.id, role: users.role }))[0];
  const boss = await mk("Boss", "admin"), puneet = await mk("Puneet", "analyst"), other = await mk("Other", "analyst");
  const add = async (name: string, by: { id: number }) => (await db.insert(offices).values({ name, origin: "desk", approval: "approved", addedById: by.id }).returning({ id: offices.id }))[0].id;
  const mine = await add("Boss Private Investor", boss), pun = await add("Puneet Private Investor", puneet), oth = await add("Other Private Investor", other);
  const reg = (await db.insert(offices).values({ name: "Registered Family Office" }).returning({ id: offices.id }))[0].id;

  const seen = async (me: { id: number; role: string }) => new Set((await db.select({ id: offices.id }).from(offices).where(officeScope(me))).map((r) => r.id));
  const b = await seen(boss), p = await seen(puneet), o = await seen(other);
  for (const id of [mine, pun, oth, reg]) assert.ok(b.has(id), "super admin sees all");
  assert.ok(p.has(pun) && p.has(reg) && !p.has(mine) && !p.has(oth), "Puneet: his own and registered offices only");
  assert.ok(o.has(oth) && o.has(reg) && !o.has(mine) && !o.has(pun), "other analyst: their own and registered offices only");
  assert.equal((await names(puneet)).office.has(mine), false, "dropdowns follow the same rule");
  assert.ok((await hiddenOffices(puneet)).has(mine));
  assert.equal((await hiddenOffices(boss)).size, 0);
  const [row] = await db.select().from(offices).where(and(eq(offices.id, mine)));
  assert.equal(canSeeOffice(puneet, row), false); assert.equal(canSeeOffice(boss, row), true);
});
