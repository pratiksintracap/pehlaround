import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appDevices, users } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { readBody, str, jerr } from "@/lib/http";
import { PLATFORMS, newSecret, hashSecret } from "@/lib/app-device";

// Turning on Face ID / fingerprint sign-in: the server makes a device secret and returns it once. The app
// stores it in the phone's keychain behind the biometric check; only its hash stays here.
export async function POST(req: NextRequest) {
  const u = await getUser(); if (!u) return jerr("Please sign in.", 401);
  const { data } = await readBody(req);
  const platform = str(data.platform, 10) as (typeof PLATFORMS)[number];
  if (!PLATFORMS.includes(platform)) return jerr("Missing device details.");
  const db = await getDb();
  const [me] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, u.id));
  const secret = newSecret();
  // The phone usually registered for push first: keep one row per phone.
  const pushToken = str(data.pushToken, 400);
  const [had] = pushToken ? await db.select({ id: appDevices.id }).from(appDevices).where(and(eq(appDevices.pushToken, pushToken), eq(appDevices.userId, u.id))) : [];
  const vals = { secretHash: hashSecret(secret), sessionVersion: me?.v ?? 0, platform, revokedAt: null, lastSeenAt: new Date() };
  const [d] = had
    ? await db.update(appDevices).set(vals).where(eq(appDevices.id, had.id)).returning({ id: appDevices.id })
    : await db.insert(appDevices).values({ userId: u.id, name: str(data.name, 80) || null, ...vals }).returning({ id: appDevices.id });
  await log({ id: u.id, name: u.name, officeId: u.officeId ?? null }, `Turned on ${platform === "ios" ? "Face ID / Touch ID" : "fingerprint"} sign-in in the app`);
  return NextResponse.json({ ok: true, deviceId: d.id, secret });
}
