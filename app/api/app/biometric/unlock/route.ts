import { type NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appDevices, users } from "@/db/schema";
import { createSession, log } from "@/lib/auth";
import { readBody, str, safeNext, jerr } from "@/lib/http";
import { allowIp, TOO_MANY } from "@/lib/rate";
import { hashSecret, sameHash } from "@/lib/app-device";

// Signing in with Face ID / fingerprint: the phone has already checked the face or finger and released the
// device secret from its keychain. A secret from before "sign out everywhere", or a revoked phone, fails.
export async function POST(req: NextRequest) {
  if (!(await allowIp("app-unlock", 20, 900))) return jerr(TOO_MANY, 429);
  const { data } = await readBody(req);
  const id = Number(data.deviceId) || 0, secret = str(data.secret, 200);
  if (!id || !secret) return jerr("Please sign in with your email.", 400);
  const db = await getDb();
  const [d] = await db.select().from(appDevices).where(and(eq(appDevices.id, id), isNull(appDevices.revokedAt)));
  if (!d?.secretHash || !sameHash(d.secretHash, hashSecret(secret))) return jerr("Face ID sign-in has been turned off for this phone. Please sign in with your email.", 401);
  const [u] = await db.select().from(users).where(eq(users.id, d.userId));
  if (!u || u.disabled || (u.sessionVersion ?? 0) !== (d.sessionVersion ?? 0)) {
    await db.update(appDevices).set({ revokedAt: new Date() }).where(eq(appDevices.id, d.id));
    return jerr("Please sign in with your email once more.", 401);
  }
  await createSession(u.id);
  await db.update(appDevices).set({ lastSeenAt: new Date() }).where(eq(appDevices.id, d.id));
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await log({ id: u.id, name: u.name, officeId: u.officeId }, `Signed in with ${d.platform === "ios" ? "Face ID / Touch ID" : "fingerprint"} in the app`);
  return NextResponse.json({ ok: true, next: safeNext(data.next, "/dashboard") });
}
