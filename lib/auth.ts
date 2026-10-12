import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, offices, audit } from "@/db/schema";

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
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
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
    const office = u.officeId ? (await db.select().from(offices).where(eq(offices.id, u.officeId)))[0] ?? null : null;
    return { ...u, office };
  } catch {
    return null;
  }
}

export async function requireUser(next = "/dashboard") {
  const u = await getUser();
  if (!u) redirect("/login?next=" + encodeURIComponent(next));
  return u;
}

export async function requireAdmin() {
  const u = await getUser();
  if (!u) redirect("/login?next=/admin");
  if (u.role !== "admin") redirect("/dashboard");
  return u;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
}

export async function log(u: { id: number; name: string; officeId: number | null } | null, action: string, dealId?: number | null) {
  const db = await getDb();
  await db.insert(audit).values({ userId: u?.id ?? null, officeId: u?.officeId ?? null, who: u?.name ?? null, action, dealId: dealId ?? null, ip: await clientIp() });
}

/** Whether the office's PAN must be verified by the desk before any room opens. */
export const REQUIRE_VERIFIED = process.env.REQUIRE_PAN_VERIFIED === "1";

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export function maskPan(p?: string | null) { return p ? p.slice(0, 5) + "••••" + p.slice(9) : "—"; }
