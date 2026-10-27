// Fails the build if investor-facing code reads the deals table without the listed-company guard.
// Desk-only code (admin pages and actions, the workflow) is allowed to read every deal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const DESK_ONLY = [/^app\/admin\//, /^lib\/admin-actions\.ts$/, /^lib\/desk(-actions)?\.ts$/, /^lib\/task-reminders\.ts$/, /^lib\/desk-weekly\.ts$/, /^lib\/peer-draft\.ts$/, /^lib\/call-list\.ts$/, /^app\/desk\//, /^lib\/pipeline\.ts$/, /^lib\/db\.ts$/,
  /^lib\/deal-guard\.ts$/, /^components\/(DeskWorkspace|DeskBits|AdminNav|AdminBits)\.tsx$/];
const walk = (dir: string): string[] => readdirSync(path.join(root, dir)).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(path.join(root, p)).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p.split(path.sep).join("/")] : [];
});

test("every investor-facing read of deals carries the listed guard", () => {
  const bad: string[] = [];
  for (const f of [...walk("app"), ...walk("lib"), ...walk("components")]) {
    if (DESK_ONLY.some((r) => r.test(f))) continue;
    const src = readFileSync(path.join(root, f), "utf8");
    const imp = /import\s*{([^}]*)}\s*from\s*"@\/db\/schema"/.exec(src)?.[1] ?? "";
    const names = ["deals", "schema.deals", ...[...imp.matchAll(/\bdeals\s+as\s+(\w+)/g)].map((m) => m[1])];
    if (!/\bdeals\b/.test(imp) && !/schema\.deals/.test(src) && !/(from|join)\s+deals\b/i.test(src)) continue;
    const re = new RegExp(`\\.from\\(\\s*(${names.map((n) => n.replace(".", "\\.")).join("|")})\\s*\\)|\\b(from|join)\\s+deals\\b`, "g");
    for (const m of src.matchAll(re)) {
      const stmt = src.slice(m.index!, m.index! + 400).split(/;\s*\n|\n\s*\n/)[0];
      if (!/investorWhere\(|notListed|investorVisible/.test(stmt)) bad.push(`${f}:${src.slice(0, m.index!).split("\n").length}`);
    }
  }
  assert.deepEqual(bad, [], `Deals read without the listed guard (use investorWhere from lib/deal-guard.ts):\n${bad.join("\n")}`);
});

test("the public deal cache filters listed companies", () => {
  const src = readFileSync(path.join(root, "lib/deals.ts"), "utf8");
  assert.match(src, /where\(notListed\)/);
  assert.match(src, /filter\(investorVisible\)/);
});
