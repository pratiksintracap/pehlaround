// The phone-app desk (/desk) must keep the same privacy as the console: an analyst sees only the investors
// they added by hand (plus registered offices), and every screen is desk-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the app desk is desk-only", () => {
  assert.match(read("app/desk/layout.tsx"), /await requireDesk\(\)/);
  for (const p of ["app/desk/page.tsx", "app/desk/pipeline/page.tsx", "app/desk/investors/page.tsx", "app/desk/investors/[id]/page.tsx", "app/desk/tasks/page.tsx"])
    assert.match(read(p), /requireDesk\(\)/, `${p} checks the desk itself`);
});

test("the app desk keeps hand-added investors private", () => {
  assert.match(read("app/desk/investors/page.tsx"), /officeScope\(me\)/);
  assert.match(read("app/desk/investors/[id]/page.tsx"), /canSeeOffice\(me, o\)\) notFound\(\)/);
  assert.match(read("app/desk/tasks/page.tsx"), /listTasks\(\{ me,/);
  assert.match(read("app/desk/page.tsx"), /names\(me\)/);
});
