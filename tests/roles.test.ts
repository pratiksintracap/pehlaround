// The two desk roles, enforced in lib/perm.ts (every server action asks requirePerm).
import { test } from "node:test";
import assert from "node:assert/strict";
import { can, isDesk } from "@/lib/perm";

const admin = { role: "admin" }, analyst = { role: "analyst" }, member = { role: "member" };
test("super admin can do everything", () => {
  for (const p of ["workflow", "delete", "settings", "team", "investors.add", "deals.edit", "broadcast.send"] as const) assert.equal(can(admin, p), true, p);
});
test("analyst runs the pipeline but cannot delete, change settings or add investors in bulk", () => {
  for (const p of ["workflow", "deals.edit", "offices.approve", "offices.notes"] as const) assert.equal(can(analyst, p), true, p);
  for (const p of ["delete", "settings", "team", "investors.add", "broadcast.send", "emails", "invites", "offices.manage", "log.all"] as const) assert.equal(can(analyst, p), false, p);
});
test("investors and promoters have no desk rights", () => {
  assert.equal(isDesk(member), false);
  for (const p of ["workflow", "deals.edit", "investors.add"] as const) { assert.equal(can(member, p), false); assert.equal(can({ role: "promoter" }, p), false); }
});
