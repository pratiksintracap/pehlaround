"use server";
// Desk actions on the Sourcing list: move a prospect along, add one by hand, or make it a deal on the pipeline.
// A pre-IPO prospect becomes a Before the Bell deal in preparation (desk only until a super admin publishes it);
// a debt prospect becomes a debt desk deal (never public). Listed companies are not sourced here.
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, prospects } from "@/db/schema";
import { requirePerm, log } from "@/lib/auth";
import { PUBLIC_TAG } from "@/lib/cache";
import { done, fail, deskBack } from "@/lib/form";
import { addProspect, updateProspect } from "@/lib/prospects";

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const BACK = "/admin/sourcing";

export async function setProspect(f: FormData) {
  const me = await requirePerm("deals.edit");
  const r = await updateProspect({ company: s(f, "company", 200), status: s(f, "status", 20) || undefined, note: s(f, "note", 1000),
    contactEmail: s(f, "contactEmail", 200), contactName: s(f, "contactName", 120) }, me.name);
  if ("error" in r) fail(deskBack(f, BACK), r.error ?? "Couldn't save.");
  if (r.from !== r.to) await log(me, `Desk moved the prospect ${r.company} to ${r.to}${"taskId" in r ? " and added a call task" : ""}`, null, { entity: "prospect" });
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
  const room = { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [],
    interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] };
  const tag = Date.now().toString(36);
  const summary = [p.why, p.revenueCr != null && `Revenue ₹${p.revenueCr} Cr${p.fy ? ` (${p.fy})` : ""}`, p.patCr != null && `PAT ₹${p.patCr} Cr`].filter(Boolean).join(" · ").slice(0, 600);
  const [row] = await db.insert(deals).values(as === "debt"
    ? { slug: `debt-${tag}`, company: p.company, title: p.sector || "Debt", category: "Debt", headline: summary, listingLabel: "Debt", phase: "preparing",
        debt: true, debtInfo: { borrowerType: "Company", sector: p.sector ?? undefined, source: "Sourcing" }, sort: 600, pipelineStage: "sourced", stageAt: new Date(), ownerId: p.assigneeId || me.id, room }
    : { slug: `${p.norm.replace(/\s+/g, "-").slice(0, 40)}-${tag}`, company: p.company, title: p.sector || "Pre-IPO", category: "Pre-IPO primary", headline: summary,
        listingLabel: "To be set", phase: "preparing", sort: 200, pipelineStage: "sourced", stageAt: new Date(), ownerId: p.assigneeId || me.id, room })
    .returning({ id: deals.id });
  await db.update(prospects).set({ status: "added", dealId: row.id, updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await log(me, `Desk moved the prospect ${p.company} onto the ${as === "debt" ? "debt desk" : "Before the Bell"} pipeline`, row.id, { entity: "deal", entityId: row.id });
  revalidateTag(PUBLIC_TAG);
  done(as === "debt" ? `/admin/debt/${row.id}` : `/admin/deals/${row.id}`, `${p.company} is on the pipeline at Sourced, desk only.`);
}
