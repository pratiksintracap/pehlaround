// Every researched peer comparison must be well-formed (one value per company on every row), must not
// name a listed-company deal, and must keep valuation out of the "ahead" claims.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { checkCompare, peerCompareFor } from "@/lib/peers";

const dir = new URL("../lib/peers/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

test("each comparison is well-formed and reachable by its slug", () => {
  assert.ok(files.length >= 6);
  for (const f of files) {
    const c = checkCompare(JSON.parse(readFileSync(new URL(f, dir), "utf8")));
    assert.ok(c.companies[0], f);
    assert.ok(peerCompareFor(f.replace(/\.json$/, "")), `${f} loads by slug`);
  }
});

test("valuation claims stay out of the 'ahead' list", () => {
  for (const f of files) {
    const c = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    for (const t of c.stands.ahead) assert.doesNotMatch(t, /P\/E|EV\/|price ?\/ ?(book|sales)|cheap|undervalued|discount to peers/i, `${f}: ${t}`);
  }
});

test("a broken comparison is refused, not shown", () => {
  assert.throws(() => checkCompare({ companies: [{ name: "A", short: "A" }, { name: "B", short: "B" }], metrics: [{ group: "Scale", label: "Revenue", unit: "₹ Cr", better: "high", vals: [1] }], dims: [], matrix: [], barriers: [], sources: [], stands: { ahead: [], behind: [], watch: [] } }));
});
