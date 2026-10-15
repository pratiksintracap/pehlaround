import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { events, offices } from "@/db/schema";
import { REF_COOKIE, SRC_COOKIE, REF_RE, type Source } from "@/lib/source";

export type EventKind = "register_started" | "register_completed" | "office_approved" | "nda_signed" | "room_opened"
  | "question_asked" | "allocation_requested" | "call_requested" | "subscribed" | "referral_visit";

/** The first-touch source saved by the middleware, if any. */
export async function readSource(): Promise<Source | null> {
  try {
    const v = (await cookies()).get(SRC_COOKIE)?.value;
    if (!v) return null;
    const o = JSON.parse(v) as Source;
    return o && typeof o === "object" ? o : null;
  } catch { return null; }
}

/** The invite code a visitor arrived with (from /r/<code> or ?ref=), if any. */
export async function readRefCode(explicit?: string) {
  const c = explicit || (await cookies()).get(REF_COOKIE)?.value || "";
  return REF_RE.test(c) ? c.toLowerCase() : null;
}

/** Record one step of the funnel. Best effort: never throws, never slows the page. */
export async function track(kind: EventKind, o: { officeId?: number | null; userId?: number | null; dealId?: number | null; meta?: Record<string, string | number | boolean>; source?: Source | null } = {}) {
  try {
    const db = await getDb();
    const source = o.source === undefined ? await readSource().catch(() => null) : o.source;
    await db.insert(events).values({ kind, officeId: o.officeId ?? null, userId: o.userId ?? null, dealId: o.dealId ?? null, source, meta: o.meta ?? null });
  } catch (e) { console.error("track", kind, e); }
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
export function newRefCode(len = 8) {
  const b = randomBytes(len);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

/** The office's invite code, created on first use. */
export async function officeRefCode(officeId: number, current?: string | null) {
  if (current) return current;
  const db = await getDb();
  for (let i = 0; i < 5; i++) {
    const code = newRefCode();
    try {
      await db.update(offices).set({ refCode: code }).where(eq(offices.id, officeId));
      return code;
    } catch { /* collision: try another */ }
  }
  return null;
}

/** The approved office behind an invite code, for the register page and the register route. */
export async function referrerByCode(code: string | null) {
  if (!code) return null;
  const db = await getDb();
  const [o] = await db.select({ id: offices.id, name: offices.name, approval: offices.approval, refCode: offices.refCode }).from(offices).where(eq(offices.refCode, code));
  return o ?? null;
}
