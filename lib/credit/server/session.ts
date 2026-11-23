import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { isSuper } from "@/lib/perm";
import { withContext } from "@/lib/credit/db";
import { users } from "@/lib/credit/schema";
import { actorFromToken } from "./auth";
import type { AdminActor, ApplicantUserActor, LenderActor, PartnerActor, Actor } from "./actors";

/*
 * Request-level guards. Every dashboard page, server action and route handler calls one of these first.
 * The role is always read from the server-side session, never from anything the client sends.
 */

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-credit_session" : "credit_session";
export const PRE_SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-credit_pre" : "credit_pre";

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export const currentActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const a = token ? await actorFromToken(token) : null;
  return a ?? deskAdminActor();
});

/*
 * Before the Bell's super admins are the credit platform team: signed in to the site, they reach /credit/admin
 * without a second sign-in. Their credit user (role platform_admin) is made on first visit, keyed by email, so the
 * credit audit trail still names them. An email already used by a lender, partner or applicant is never promoted.
 */
async function deskAdminActor(): Promise<AdminActor | null> {
  const u = await getUser();
  if (!u || !isSuper(u) || !u.email) return null;
  const email = u.email.toLowerCase();
  const row = await withContext({ role: "admin", userId: "" }, async (tx) => {
    const [found] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    if (found) return found;
    const [made] = await tx.insert(users).values({ email, name: u.name || email, role: "platform_admin" }).returning();
    return made;
  });
  if (!row || row.role !== "platform_admin" || row.disabledAt) return null;
  return { kind: "admin", userId: row.id, name: row.name, email: row.email };
}

export async function requestIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/** Pages: signed-out users go to login; signed-in users of the wrong role get a 404. */
export async function requireAdmin(): Promise<AdminActor> {
  const a = await currentActor();
  if (!a) redirect("/credit/login");
  if (a.kind !== "admin") notFound();
  return a;
}

export async function requireLender(): Promise<LenderActor> {
  const a = await currentActor();
  if (!a) redirect("/credit/login");
  if (a.kind !== "lender") notFound();
  return a;
}

export async function requirePartner(): Promise<PartnerActor> {
  const a = await currentActor();
  if (!a) redirect("/credit/login");
  if (a.kind !== "partner") notFound();
  return a;
}

export async function requireApplicantUser(): Promise<ApplicantUserActor> {
  const a = await currentActor();
  if (!a) redirect("/credit/login");
  if (a.kind !== "applicant_user") notFound();
  return a;
}
