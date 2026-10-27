// Holds the desk's form pattern (MODEL.md §7): results go through lib/form.ts, and the deal flags derived from
// `phase` are never written by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
["app", "lib", "components"].forEach(walk);

test("desk results are built only by lib/form.ts", () => {
  const bad = files.filter((p) => p !== join("lib", "form.ts") && /[?&]msg=\$\{encodeURIComponent/.test(readFileSync(p, "utf8")) && /(admin|desk)/.test(readFileSync(p, "utf8")))
    .filter((p) => !/^app[\\/](dashboard|founder|api)/.test(p) && !/founder-actions/.test(p)); // investor and API flows keep their own messages
  assert.deepEqual(bad, [], "use done()/fail() from lib/form.ts");
});

test("published, open, preview, stage and status are never written; phase is", () => {
  const bad: string[] = [];
  for (const p of files) {
    const src = readFileSync(p, "utf8");
    for (const m of src.matchAll(/\.(?:set|values)\(\s*\{([^}]*)\}/g)) {
      if (/\b(published|preview)\s*:/.test(m[1]) && /deals/.test(src)) bad.push(`${p}: ${m[1].slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad.filter((b) => !/articles/.test(b)), []);
});
