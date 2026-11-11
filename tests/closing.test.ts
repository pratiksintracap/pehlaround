// The closing of an allocation: which of the four steps are done, from the request's status and the dates the desk
// recorded; when a request counts as closing; and which steps are new (the office is told once per step).
import { test } from "node:test";
import assert from "node:assert/strict";
import { closingSteps, isClosing, freshSteps, closingFrom } from "@/lib/closing";

const done = (status: string, c = {}) => closingSteps(status, c).map((s) => s.done);
test("status implies steps; dates add to them; a later step implies the earlier ones", () => {
  assert.deepEqual(done("Indicated"), [false, false, false, false]);
  assert.deepEqual(done("Term sheet"), [true, false, false, false]);
  assert.deepEqual(done("Documents"), [true, true, false, false]);
  assert.deepEqual(done("Documents", { funds: "2026-11-20" }), [true, true, true, false]);
  assert.deepEqual(done("Indicated", { funds: "2026-11-20" }), [true, true, true, false]);
  assert.deepEqual(done("Allotted"), [true, true, true, true]);
  assert.equal(closingSteps("Documents", {}).find((s) => s.now)?.key, "funds");
});
test("closing means started and not finished; withdrawn never", () => {
  assert.equal(isClosing("Indicated", {}), false);
  assert.equal(isClosing("Term sheet", {}), true);
  assert.equal(isClosing("Allotted", {}), false);
  assert.equal(isClosing("Withdrawn", { termSheet: "2026-11-01" }), false);
});
test("fresh steps are the ones dated for the first time; bad dates are dropped", () => {
  assert.deepEqual(freshSteps({ termSheet: "2026-11-01" }, { termSheet: "2026-11-01", documents: "2026-11-05" }).map((s) => s.key), ["documents"]);
  assert.deepEqual(closingFrom((k) => ({ termSheet: "2026-11-01", documents: "soon", funds: "2026-13-45", fundsDue: " 2026-11-30 " } as Record<string, string>)[k] ?? ""), { termSheet: "2026-11-01", fundsDue: "2026-11-30" });
});
