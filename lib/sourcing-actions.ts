"use server";
// Desk actions on the Sourcing list: move a prospect along, add one by hand, or make it a deal on the pipeline.
// A pre-IPO prospect becomes a Before the Bell deal in preparation (desk only until a super admin publishes it);
// a debt prospect becomes a debt desk deal (never public). Listed companies are not sourced here.
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects } from "@/db/schema";
import { requirePerm, log } from "@/lib/auth";
import { PUBLIC_TAG } from "@/lib/cache";
import { done, fail, deskBack } from "@/lib/form";
import { addProspect, approveAllProspects, approveProspect, prospectDeal, updateProspect } from "@/lib/prospects";

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const BACK = "/admin/sourcing";

export async function setProspect(f: FormData) {
  const me = await requirePerm("deals.edit");
  const r = await updateProspect({ company: s(f, "company", 200), status: s(f, "status", 20) || undefined, note: s(f, "note", 1000),
    contactEmail: s(f, "contactEmail", 200), contactName: s(f, "contactName", 120) }, me.name);
  if ("error" in r) fail(deskBack(f, BACK), r.error ?? "Couldn't save.");
  if (r.from !== r.to) await log(me, `Desk moved the prospect ${r.company} to ${r.to}${"taskId" in r ? " and added a call task" : ""}${"dealId" in r ? "; it is now on the deal pipeline" : ""}`, "dealId" in r ? (r.dealId as number) : null, { entity: "prospect" });
  if ("dealId" in r) done(r.kind === "debt" ? `/admin/debt/${r.dealId}` : `/admin/deals/${r.dealId}`, `${r.company} replied with interest, so it is now on the deal pipeline at Sourced (desk only)${"taskId" in r ? ", with the call task on it" : ""}.`);
  done(deskBack(f, BACK), "taskId" in r ? `Saved. A call task for ${r.company} is on Tasks, due the next working day.` : "Saved.");
}

export async function addProspectByHand(f: FormData) {
  const me = await requirePerm("deals.edit");
  const r = await addProspect({ company: s(f, "company", 200), sector: s(f, "sector", 120), city: s(f, "city", 80), kind: s(f, "kind", 10),
    revenueCr: s(f, "revenueCr", 20), patCr: s(f, "patCr", 20), why: s(f, "why", 1500), contactName: s(f, "contactName", 120),
    contactEmail: s(f, "contactEmail", 200), website: s(f, "website", 300) }, me.name);
  if ("error" in r) fail(BACK, r.error ?? "Couldn't add.");
  if ("exists" in r) fail(BACK, "That company is already on the list.");
  await log(me, `Desk added a prospect: ${s(f, "company", 200)}`, null, { entity: "prospect", entityId: (r as { id: number }).id });
  done(BACK, "Added to Sourcing.");
}

export async function prospectToDeal(f: FormData) {
  const me = await requirePerm("deals.edit");
  const id = Number(f.get("id")) || 0;
  const as = s(f, "as", 10) === "debt" ? "debt" : "equity";
  const db = await getDb();
  const [p] = await db.select().from(prospects).where(eq(prospects.id, id));
  if (!p) fail(BACK, "That prospect is gone.");
  if (p.dealId) fail(BACK, `${p.company} is already on the pipeline.`);
  const dealId = await prospectDeal(p, as, me.id);
  const row = { id: dealId };
  await log(me, `Desk moved the prospect ${p.company} onto the ${as === "debt" ? "debt desk" : "Before the Bell"} pipeline`, row.id, { entity: "deal", entityId: row.id });
  revalidateTag(PUBLIC_TAG);
  done(as === "debt" ? `/admin/debt/${row.id}` : `/admin/deals/${row.id}`, `${p.company} is on the pipeline at Sourced, desk only.`);
}

/** Saves the desk's edits to an outreach email (recipient, subject, body). Saving never sends. */
export async function saveProspectEmail(f: FormData) {
  return saveEmail(f, s(f, "then", 10) === "approve");
}

/** The approve button's own action, so approving never depends on the browser sending which button was pressed. */
export async function approveProspectEmail(f: FormData) {
  return saveEmail(f, true);
}

async function saveEmail(f: FormData, approve: boolean) {
  const me = await requirePerm("deals.edit");
  const company = s(f, "company", 200);
  const r = await updateProspect({ company, contactEmail: s(f, "contactEmail", 200), contactName: s(f, "contactName", 120), emailSubject: s(f, "emailSubject", 300), emailBody: s(f, "emailBody", 3000),
    ...(s(f, "emailBody", 3000).length > 40 && s(f, "emailSubject", 300) ? { status: "drafted" } : {}) }, me.name);
  if ("error" in r) fail(deskBack(f, BACK), r.error ?? "Couldn't save.");
  if (!approve) done(deskBack(f, BACK), "Email saved. Nothing was sent.");
  const a = await approveProspect(Number(f.get("id")) || 0, me.name);
  if ("error" in a) fail(deskBack(f, BACK), a.error);
  await log(me, a.sent ? `Desk approved and sent the outreach email to ${a.company}` : `Desk approved the outreach email to ${a.company}; it goes at 9 AM`, null, { entity: "prospect" });
  done(deskBack(f, BACK), a.sent ? `Sent to ${a.company} from the desk address.` : `Approved. It is outside sending hours, so the email to ${a.company} goes at 9 AM on the next working day.`);
}

export async function approveAllProspectEmails(f: FormData) {
  const me = await requirePerm("deals.edit");
  const a = await approveAllProspects(me.name);
  if ("error" in a) fail(deskBack(f, BACK), a.error);
  await log(me, `Desk approved ${a.approved} outreach emails in one go; ${a.sent} sent at once`, null, { entity: "prospect" });
  const rest = a.approved - a.sent;
  done(deskBack(f, BACK), `Approved ${a.approved} emails.${a.sent ? ` ${a.sent} sent now from the desk address.` : ""}${rest ? ` The other ${rest} go out from 9 AM on working days, up to 40 a day.` : ""}${a.skipped ? ` ${a.skipped} drafts without a recipient were left at Draft ready.` : ""}`);
}

/** Loads one batch of pool rows from the file the desk uploads on the pool page. */
export async function loadPool(rows: Record<string, unknown>[], source: string) {
  const me = await requirePerm("deals.edit");
  if (!Array.isArray(rows) || rows.length > 400) return { error: "Send at most 400 rows at a time." };
  const { upsertPool } = await import("@/lib/pool");
  const n = await upsertPool(rows, String(source ?? "").slice(0, 120) || "upload");
  if (n) await log(me, `Desk loaded ${n} companies into the sourcing pool`, null, { entity: "pool" });
  return { ok: true, loaded: n };
}
