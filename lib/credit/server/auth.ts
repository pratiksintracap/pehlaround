import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { withContext } from "@/lib/credit/db";
import { loginCodes, sessions, users } from "@/lib/credit/schema";
import { decrypt, encrypt, keyedHash, newLoginCode, newSessionToken, newTotpSecret, safeEqualHex, verifyTotp } from "./crypto";
import { sendMail } from "./mailer";
import { logActivity } from "./activity";
import type { Actor } from "./actors";

/*
 * Login: email one-time code, then an authenticator-app (TOTP) code. No self sign-up: only users created
 * by a platform admin can sign in. Responses never reveal whether an email has an account.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const CODE_REQUESTS_PER_WINDOW = 5;
const CODE_WINDOW_MS = 15 * 60 * 1000;
const PRE_SESSION_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** Signed-in sessions end after this long without activity (env SESSION_IDLE_MINUTES, default 30). */
const IDLE_MS = Number(process.env.SESSION_IDLE_MINUTES ?? 30) * 60 * 1000;
const CODE_REQUESTS_PER_IP_PER_WINDOW = 20;
import { BRAND_NAME as BRAND } from "@/lib/credit/brand";

const auth = { role: "auth" as const };
const RESEND_AFTER_MS = 60 * 1000;
const normalise = (email: string) => email.trim().toLowerCase();

export async function requestLoginCode(emailRaw: string, ip: string | null): Promise<void> {
  const email = normalise(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const send = await withContext(auth, async (tx) => {
    const recent = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(loginCodes)
      .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, new Date(Date.now() - CODE_WINDOW_MS))));
    if ((recent[0]?.n ?? 0) >= CODE_REQUESTS_PER_WINDOW) return null;
    if (ip) {
      const fromIp = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(loginCodes)
        .where(and(eq(loginCodes.ip, ip), gt(loginCodes.createdAt, new Date(Date.now() - CODE_WINDOW_MS))));
      if ((fromIp[0]?.n ?? 0) >= CODE_REQUESTS_PER_IP_PER_WINDOW) return null;
    }
    const [user] = await tx.select().from(users).where(eq(users.email, email));
    if (!user || user.disabledAt) {
      // Still record the attempt so rate limiting applies to unknown emails too.
      await tx.insert(loginCodes).values({ email, codeHash: keyedHash("unused:" + newSessionToken()), expiresAt: new Date(), ip });
      return null;
    }
    // A code sent in the last minute is still on its way: don't send another (double-clicks, impatient retries).
    const [fresh] = await tx
      .select({ id: loginCodes.id })
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.email, email),
          isNull(loginCodes.consumedAt),
          gt(loginCodes.expiresAt, new Date()),
          gt(loginCodes.createdAt, new Date(Date.now() - RESEND_AFTER_MS)),
        ),
      )
      .limit(1);
    if (fresh) return null;
    const code = newLoginCode();
    await tx.insert(loginCodes).values({ email, codeHash: keyedHash(email + ":" + code), expiresAt: new Date(Date.now() + CODE_TTL_MS), ip });
    return code;
  });
  if (send) {
    // A mail failure is logged, not shown: showing it only for invited emails would reveal who has an account.
    try {
      await sendMail(email, `${BRAND} sign-in code`, `Your sign-in code is ${send}. It expires in 10 minutes.`);
    } catch (e) {
      console.error("[login] sign-in code email could not be sent", e);
    }
  }
}

export type PreSession = { token: string; stage: "totp_enroll" | "totp_verify" | "active" };

/**
 * Whether sign-in also needs an authenticator app after the emailed code. Off unless REQUIRE_AUTHENTICATOR=true:
 * the platform owner chose email-code sign-in only (26 Oct 2026). Turning it back on needs no data changes.
 */
export function authenticatorRequired(): boolean {
  return process.env.REQUIRE_AUTHENTICATOR === "true";
}

export async function verifyLoginCode(emailRaw: string, code: string, ip: string | null, userAgent: string | null): Promise<PreSession | null> {
  const email = normalise(emailRaw);
  if (!/^\d{6}$/.test(code)) return null;
  return withContext(auth, async (tx) => {
    // Any code still live for this email works (someone who asked twice may type the first one).
    const live = await tx
      .select()
      .from(loginCodes)
      .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt), gt(loginCodes.expiresAt, new Date())))
      .orderBy(desc(loginCodes.createdAt))
      .limit(5);
    const newest = live[0];
    if (!newest || live.some((r) => r.attempts >= CODE_MAX_ATTEMPTS)) return null;
    const row = live.find((r) => safeEqualHex(r.codeHash, keyedHash(email + ":" + code)));
    if (!row) {
      await tx.update(loginCodes).set({ attempts: newest.attempts + 1 }).where(eq(loginCodes.id, newest.id));
      return null;
    }
    const [user] = await tx.select().from(users).where(eq(users.email, email));
    if (!user || user.disabledAt) return null;
    await tx.update(loginCodes).set({ consumedAt: new Date() }).where(eq(loginCodes.id, row.id));
    const token = newSessionToken();
    if (!authenticatorRequired()) {
      // Email code is the only factor: the code check above completes sign-in.
      await tx.insert(sessions).values({
        tokenHash: keyedHash(token),
        userId: user.id,
        stage: "active",
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip,
        userAgent,
      });
      await logActivity(tx, { kind: "system", role: "auth", userId: user.id }, "auth.signed_in", "user", user.id);
      return { token, stage: "active" as const };
    }
    const stage = user.totpEnabledAt ? "totp_verify" : "totp_enroll";
    await tx.insert(sessions).values({
      tokenHash: keyedHash(token),
      userId: user.id,
      stage,
      expiresAt: new Date(Date.now() + PRE_SESSION_TTL_MS),
      ip,
      userAgent,
    });
    return { token, stage };
  });
}

type SessionRow = typeof sessions.$inferSelect;
type UserRow = typeof users.$inferSelect;

async function loadSession(token: string): Promise<{ session: SessionRow; user: UserRow } | null> {
  if (!token || token.length > 200) return null;
  return withContext(auth, async (tx) => {
    const [row] = await tx
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, keyedHash(token)), gt(sessions.expiresAt, new Date())));
    if (!row || row.user.disabledAt) return null;
    const now = Date.now();
    if (row.session.stage === "active") {
      if (now - row.session.lastSeenAt.getTime() > IDLE_MS) {
        await tx.delete(sessions).where(eq(sessions.id, row.session.id));
        return null;
      }
      // Refresh at most once a minute to avoid a write on every request.
      if (now - row.session.lastSeenAt.getTime() > 60_000) {
        await tx.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, row.session.id));
      }
    }
    return row;
  });
}

export async function getPreSession(token: string) {
  const s = await loadSession(token);
  if (!s || s.session.stage === "active") return null;
  return s;
}

/** Resolve a fully authenticated actor from a session token, or null. */
export async function actorFromToken(token: string): Promise<Actor | null> {
  const s = await loadSession(token);
  if (!s || s.session.stage !== "active") return null;
  const u = s.user;
  if (u.role === "platform_admin") return { kind: "admin", userId: u.id, name: u.name, email: u.email };
  if (u.role === "applicant") return { kind: "applicant_user", userId: u.id, name: u.name, email: u.email };
  if (u.role === "partner") return u.partnerId ? { kind: "partner", userId: u.id, name: u.name, email: u.email, partnerId: u.partnerId } : null;
  if (!u.lenderId) return null;
  return { kind: "lender", userId: u.id, name: u.name, email: u.email, lenderId: u.lenderId, role: u.role };
}

/** Returns the base32 secret to show in the enrolment screen. Creates it on first call. */
export async function beginTotpEnrolment(token: string): Promise<{ secret: string; email: string } | null> {
  const s = await getPreSession(token);
  if (!s || s.session.stage !== "totp_enroll") return null;
  if (s.user.totpSecret) return { secret: decrypt(s.user.totpSecret), email: s.user.email };
  const secret = newTotpSecret();
  await withContext(auth, (tx) => tx.update(users).set({ totpSecret: encrypt(secret) }).where(eq(users.id, s.user.id)));
  return { secret, email: s.user.email };
}

/** Verifies the authenticator code; on success replaces the pre-session with a fresh full session token. */
export async function completeTotp(token: string, code: string, ip: string | null, userAgent: string | null): Promise<string | null> {
  const s = await getPreSession(token);
  if (!s || !s.user.totpSecret) return null;
  if (!verifyTotp(decrypt(s.user.totpSecret), code.trim())) {
    await withContext(auth, (tx) =>
      logActivity(tx, { kind: "system", role: "auth", userId: s.user.id }, "auth.totp_failed", "user", s.user.id),
    );
    return null;
  }
  const fresh = newSessionToken();
  await withContext(auth, async (tx) => {
    if (s.session.stage === "totp_enroll") {
      await tx.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, s.user.id));
    }
    await tx.delete(sessions).where(eq(sessions.id, s.session.id));
    await tx.insert(sessions).values({
      tokenHash: keyedHash(fresh),
      userId: s.user.id,
      stage: "active",
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip,
      userAgent,
    });
    await logActivity(tx, { kind: "system", role: "auth", userId: s.user.id }, "auth.signed_in", "user", s.user.id);
  });
  return fresh;
}

export async function destroySession(token: string) {
  if (!token) return;
  await withContext(auth, (tx) => tx.delete(sessions).where(eq(sessions.tokenHash, keyedHash(token))));
}
