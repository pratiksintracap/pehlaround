// Mobile sign-in: numbers are read the way people type them, and a number opens only an approved, unambiguous account.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "@/lib/db";
import { users, offices } from "@/db/schema";
import { normPhone, maskPhone, userForPhone } from "@/lib/phone-login";

test("numbers are normalised to E.164, Indian by default", () => {
  for (const s of ["9876543210", "+91 98765 43210", "098765-43210", "919876543210", "0091 9876543210", "(+91) 98765.43210"]) assert.equal(normPhone(s), "+919876543210", s);
  assert.equal(normPhone("+44 7700 900123"), "+447700900123");
  assert.equal(normPhone("12345"), null);
  assert.equal(normPhone(""), null);
  assert.equal(maskPhone("+919876543210"), "+91 ••••• •3210");
});

test("only an approved, enabled, single account is found by its number", async () => {
  const db = await getDb();
  const t = String(Date.now()).slice(-6);
  const [ok, pend] = await db.insert(offices).values([{ name: "Approved FO " + t, approval: "approved" }, { name: "Pending FO " + t, approval: "pending" }]).returning({ id: offices.id });
  const mk = (email: string, phone: string, officeId: number | null, extra: Partial<typeof users.$inferInsert> = {}) =>
    db.insert(users).values({ email, name: email, phone, officeId, passwordHash: "x", ...extra }).returning();
  const [a] = await mk(`a${t}@x.in`, `+91 98${t}01`, ok.id);
  await mk(`p${t}@x.in`, `98${t}02`, pend.id);                         // office not approved
  await mk(`d${t}@x.in`, `98${t}03`, ok.id, { disabled: true });      // disabled
  await mk(`s1${t}@x.in`, `98${t}04`, ok.id); await mk(`s2${t}@x.in`, `+91-98${t}04`, ok.id); // shared line
  const [desk] = await mk(`k${t}@x.in`, `98${t}05`, null, { role: "analyst" });

  assert.equal((await userForPhone(`98${t}01`))?.user.id, a.id);
  assert.equal((await userForPhone(`+9198${t}01`))?.phone, `+9198${t}01`);
  assert.equal(await userForPhone(`98${t}02`), null);
  assert.equal(await userForPhone(`98${t}03`), null);
  assert.equal(await userForPhone(`98${t}04`), null);
  assert.equal((await userForPhone(`98${t}05`))?.user.id, desk.id);
  assert.equal(await userForPhone(`+4498${t}01`), null);             // same last ten digits, other country
});
