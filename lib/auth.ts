import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, offices, audit, type AuditDetail } from "@/db/schema";
import { can, isDesk, isSuper, type Perm } from "@/lib/perm";

const COOKIE = "pr_session";
const MAX_AGE = 60 * 60 * 24 * 30;

// SESSION_SECRET should be set in production. Without it, a database URL (itself a secret) seeds the key;
// with neither, each server instance uses a random key, so nobody can forge a session.
const FALLBACK = process.env.DATABASE_URL || process.env.POSTGRES_URL
  ? createHash("sha256").update("pehla-round|" + (process.env.DATABASE_URL || process.env.POSTGRES_URL)).digest("hex")
  : process.env.NODE_ENV === "production" ? randomBytes(32).toString("hex") : "pehla-round-local-dev";
function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET || FALLBACK);
}

export async function createSession(userId: number) {
  const db = await getDb();
  const [u] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId));
  const token = await new SignJWT({ uid: userId, v: u?.v ?? 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = typeof users.$inferSelect & { office: typeof offices.$inferSelect | null };

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = Number(payload.uid);
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.id, uid));
    if (!u || u.disabled) return null;
    if (Number(payload.v ?? 0) !== u.sessionVersion) return null; // signed out everywhere since this sign-in
    const office = u.officeId ? (await db.select().from(offices).where(eq(offices.id, u.officeId)))[0] ?? null : null;
    return { ...u, office };
  } catch {
    return null;
  }
}

/** Ends every existing sign-in of this user (after a password change, or when the desk disables them). */
export async function signOutEverywhere(userId: number) {
  const db = await getDb();
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}

export async function requireUser(next = "/dashboard") {
  const u = await getUser();
  if (!u) redirect("/login?next=" + encodeURIComponent(next));
  return u;
}

/** Super admin only. Anything not explicitly opened to analysts stays here, so a missed check fails closed. */
export async function requireAdmin() {
  const u = await requireDesk();
  if (!isSuper(u)) redirect("/admin?msg=" + encodeURIComponent("Only a super admin can do that."));
  return u;
}

/** Anyone on the desk: super admin or analyst. */
export async function requireDesk() {
  const u = await getUser();
  if (!u) redirect("/login?next=/admin");
  if (!isDesk(u)) redirect("/dashboard");
  return u;
}

/** A desk member allowed this action (see lib/perm.ts). */
export async function requirePerm(p: Perm) {
  const u = await requireDesk();
  if (!can(u, p)) redirect("/admin?msg=" + encodeURIComponent("Only a super admin can do that."));
  return u;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
}

/** One row in the audit trail. `more` adds the structured part for desk changes: the record and the fields that changed. */
export async function log(u: { id: number; name: string; officeId: number | null } | null, action: string, dealId?: number | null,
  more?: { entity?: string; entityId?: number | null; officeId?: number | null; detail?: AuditDetail | null }) {
  const db = await getDb();
  await db.insert(audit).values({ userId: u?.id ?? null, officeId: more?.officeId ?? u?.officeId ?? null, who: u?.name ?? null, action, dealId: dealId ?? null, ip: await clientIp(),
    entity: more?.entity ?? null, entityId: more?.entityId ?? null, detail: more?.detail && (more.detail.note || Object.keys(more.detail.changes || {}).length) ? more.detail : null });
}

/** The fields that differ between two versions of a record, as { field: [before, after] } (long text is trimmed). */
export function changes<T extends Record<string, unknown>>(before: Partial<T> | null | undefined, after: Partial<T>, keys?: (keyof T)[]) {
  const out: Record<string, [unknown, unknown]> = {};
  const norm = (v: unknown) => v instanceof Date ? v.toISOString() : typeof v === "string" && v.length > 300 ? v.slice(0, 300) + "…" : v ?? null;
  for (const k of keys ?? (Object.keys(after) as (keyof T)[])) {
    const a = norm(before?.[k]), b = norm(after[k]);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[String(k)] = [a, b];
  }
  return out;
}

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export function maskPan(p?: string | null) { return p ? p.slice(0, 5) + "••••" + p.slice(9) : "—"; }

/** A short-lived signed token (an identity confirmed by Google or Microsoft, waiting for registration). */
export async function signTemp(payload: Record<string, unknown>, minutes: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${minutes}m`).setAudience("omd-temp").sign(secret());
}
export async function verifyTemp<T = Record<string, unknown>>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try { return (await jwtVerify(token, secret(), { audience: "omd-temp" })).payload as T; } catch { return null; }
}

/** The identity confirmed by Google or Microsoft for a new registration, if any. */
export const OAUTH_PENDING = "omd_oauth_pending";
export async function pendingIdentity() {
  return verifyTemp<{ email: string; name: string; provider: string }>((await cookies()).get(OAUTH_PENDING)?.value);
}
