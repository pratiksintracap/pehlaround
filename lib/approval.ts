import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, offices, users } from "@/db/schema";
import { log } from "@/lib/auth";
import { track } from "@/lib/track";
import { notifyOffices } from "@/lib/notify";
import { startSeries } from "@/lib/onboarding";
import { investorWhere } from "@/lib/deal-guard";

export type Approval = "approved" | "pending" | "rejected";
type Actor = { id: number; name: string; officeId: number | null } | null;

/** Sets an office's approval and does what follows from it. `tell` (a reason, or "") tells a held office; null stays quiet. */
export async function applyApproval(id: number, approval: Approval, actor: Actor, tell: string | null = null, via = "") {
  const db = await getDb();
  const [o] = await db.select().from(offices).where(eq(offices.id, id));
  if (!o) return null;
  await db.update(offices).set({ approval, approvedAt: approval === "approved" ? new Date() : null }).where(eq(offices.id, id));
  await log(actor, `Desk set ${o.name} to ${approval}${via}`, null, { entity: "office", entityId: id, officeId: id, detail: { changes: o.approval !== approval ? { approval: [o.approval, approval] } : {} } });
  if (approval === "approved" && o.approval !== "approved") {
    await track("office_approved", { officeId: id, userId: actor?.id ?? null, source: o.source ?? null });
    // In-app notice only: the "You're in" email of the onboarding series does the emailing.
    const [withIntent] = await db.select({ intent: users.intent }).from(users).where(and(eq(users.officeId, id), sql`${users.intent} is not null`)).limit(1);
    const [want] = withIntent?.intent ? await db.select({ company: deals.company, slug: deals.slug }).from(deals).where(investorWhere(eq(deals.slug, withIntent.intent))) : [];
    await notifyOffices([id], { title: "Your office is approved", body: want ? `${want.company} is open to you now: sign its NDA on screen and its room opens.` : "Every company on Before the Bell is now open to you by name. Sign a company's NDA on screen to open its deal room.", link: want ? `/deals/${want.slug}#sign` : "/deals" }, false);
    const team = await db.select({ id: users.id }).from(users).where(and(eq(users.officeId, id), eq(users.disabled, false)));
    for (const t of team) await startSeries(t.id, "approved").catch(() => 0);
  }
  if (approval === "rejected" && o.approval !== "rejected" && tell !== null)
    await notifyOffices([id], { title: "Your access is on hold", body: tell || "Please write to the desk and we will help.", link: "/dashboard" });
  return o;
}

// One-tap approval from the desk's "new office registered" email. The link opens a confirm page; nothing
// changes until the button there is pressed, so mail scanners that follow links cannot approve anyone.
const secret = () => process.env.SESSION_SECRET || process.env.DATABASE_URL || "pehla-round-local-dev";
const DAYS = 7;
const mac = (id: number, exp: number) => createHmac("sha256", secret()).update(`approve|${id}|${exp}`).digest("base64url").slice(0, 32);

export function approvalToken(officeId: number) {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  return `${officeId}.${exp}.${mac(officeId, exp)}`;
}

export function readApprovalToken(t: string | null | undefined): { officeId: number } | null {
  const [a, b, m] = String(t ?? "").split(".");
  const id = Number(a), exp = Number(b);
  if (!id || !exp || !m || exp < Date.now() / 1000) return null;
  const want = Buffer.from(mac(id, exp)), got = Buffer.from(m);
  return want.length === got.length && timingSafeEqual(want, got) ? { officeId: id } : null;
}
