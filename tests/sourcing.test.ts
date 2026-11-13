// Deal sourcing: one row per company, outreach steps, and a call task only once a company replies with interest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks } from "@/db/schema";
import { deskAction } from "@/lib/agent-desk";
import { nextWorkingDay, normCompany } from "@/lib/prospects";

test("company names fold to one key", () => {
  assert.equal(normCompany("Acme Polymers Private Limited"), normCompany("ACME POLYMERS PVT. LTD."));
  assert.equal(normCompany("R&D Foods Ltd"), "r and d foods");
});

test("the next working day skips the weekend", () => {
  assert.equal(nextWorkingDay("2026-11-13"), "2026-11-16"); // Friday > Monday
  assert.equal(nextWorkingDay("2026-11-16"), "2026-11-17");
});

test("a prospect moves from found to interested, and only then gets a call task", async () => {
  const add = await deskAction({ action: "prospect", company: "Zeta Sourcing Test Industries Pvt Ltd", kind: "both", revenueCr: "240", patCr: "18",
    why: "Profitable three years running", sources: [{ title: "Rating rationale", url: "https://example.com/r" }, { title: "bad", url: "javascript:x" }] });
  assert.equal(add.ok, true);
  const dup = await deskAction({ action: "prospect", company: "ZETA SOURCING TEST INDUSTRIES LIMITED" });
  assert.equal(dup.exists, true);
  const drafted = await deskAction({ action: "prospect_update", company: "Zeta Sourcing Test Industries", status: "drafted", emailSubject: "Before the Bell: Zeta" });
  assert.equal(drafted.to, "drafted");
  assert.equal("taskId" in drafted, false);
  const emailed = await deskAction({ action: "prospect_update", company: "Zeta Sourcing Test Industries", status: "emailed" });
  assert.equal("taskId" in emailed, false);
  const yes = await deskAction({ action: "prospect_update", company: "Zeta Sourcing Test Industries", status: "interested", note: "Happy to talk next week" });
  assert.ok(yes.taskId);
  const db = await getDb();
  const [t] = await db.select().from(tasks).where(eq(tasks.id, yes.taskId as number));
  assert.match(t.title, /^Call Zeta/);
  const again = await deskAction({ action: "prospect_update", company: "Zeta Sourcing Test Industries", status: "interested" });
  assert.equal("taskId" in again, false); // one call task, not two
  const list = await deskAction({ action: "prospects" });
  const row = (list.prospects as { company: string; status: string }[]).find((p) => p.company.startsWith("Zeta"));
  assert.equal(row?.status, "interested");
  assert.ok((await deskAction({ action: "prospect_update", company: "Nobody Here", status: "emailed" })).error);
});
