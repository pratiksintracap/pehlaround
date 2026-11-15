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
  const drafted = await deskAction({ action: "prospect_update", company: "Zeta Sourcing Test Industries", status: "drafted", emailSubject: "Before the Bell: Zeta", emailBody: "Dear Sir,\n\nA short note introducing the desk and asking for a call." });
  assert.equal(drafted.to, "drafted");
  assert.equal("taskId" in drafted, false);
  const { updateProspect } = await import("@/lib/prospects");
  const emailed = await updateProspect({ company: "Zeta Sourcing Test Industries", status: "emailed" }, "Desk Tester"); // the desk sends; the assistant cannot
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

test("an email is written by the assistant, approved by the desk, and sent only in working hours", async () => {
  const { approveProspect, inSendingHours, prospectEmailHtml, runProspectSends } = await import("@/lib/prospects");
  const { prospects } = await import("@/db/schema");
  assert.equal(inSendingHours(new Date("2026-11-16T05:00:00Z")), true);   // Monday 10:30 IST
  assert.equal(inSendingHours(new Date("2026-11-15T23:40:00Z")), false);  // Monday 05:10 IST
  assert.equal(inSendingHours(new Date("2026-11-15T06:00:00Z")), false);  // Sunday
  const html = prospectEmailHtml("Dear Sir,\n\nA <b>line</b>.");
  assert.ok(html.includes("&lt;b&gt;line") && html.includes("Investment Team, Before the Bell") && html.includes("we will not write again"));
  await deskAction({ action: "prospect", company: "Yarrow Mail Test Foods Pvt Ltd", contactEmail: "cfo@yarrow-test.example" });
  assert.ok((await deskAction({ action: "prospect_update", company: "Yarrow Mail Test Foods", status: "drafted" })).error); // no email yet
  const d = await deskAction({ action: "prospect_update", company: "Yarrow Mail Test Foods", status: "drafted", emailSubject: "Yarrow Foods: capital for the next phase",
    emailBody: "Dear Sir,\n\nWe read about the new plant on your website and wanted to introduce the desk.\n\nRegards,\nSomeone Else" });
  assert.equal(d.to, "drafted");
  assert.ok((await deskAction({ action: "prospect_update", company: "Yarrow Mail Test Foods", status: "emailed" })).error);  // the assistant never sends
  assert.ok((await deskAction({ action: "prospect_update", company: "Yarrow Mail Test Foods", status: "approved" })).error);
  const db = await getDb();
  const [p] = await db.select().from(prospects).where(eq(prospects.norm, "yarrow mail test foods"));
  assert.equal(p.emailBody?.includes("Someone Else"), false); // the sign-off is the desk's own
  // Sending is switched off under test, so approval reports that and nothing goes out.
  const a = await approveProspect(p.id, "Desk Tester", new Date("2026-11-16T05:00:00Z"));
  assert.ok("error" in a);
  assert.deepEqual(await runProspectSends(new Date("2026-11-15T23:40:00Z")), { sent: 0, waiting: true });
});
