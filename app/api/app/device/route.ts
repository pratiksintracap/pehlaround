import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appDevices } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { readBody, str, jerr } from "@/lib/http";
import { PLATFORMS } from "@/lib/app-device";

// The app reports its push token after sign-in (and whenever the token changes). One row per token; a token
// that moves to another person (a shared phone) moves with it.
export async function POST(req: NextRequest) {
  const u = await getUser(); if (!u) return jerr("Please sign in.", 401);
  const { data } = await readBody(req);
  const token = str(data.token, 400), platform = str(data.platform, 10) as (typeof PLATFORMS)[number];
  if (!token || !PLATFORMS.includes(platform)) return jerr("Missing device details.");
  const db = await getDb();
  const [had] = await db.select({ id: appDevices.id }).from(appDevices).where(eq(appDevices.pushToken, token));
  if (had) await db.update(appDevices).set({ userId: u.id, platform, lastSeenAt: new Date(), revokedAt: null }).where(eq(appDevices.id, had.id));
  else {
    // A phone that already turned on Face ID sign-in keeps one row: attach the token to it.
    const devId = Number(data.deviceId) || 0;
    const [mine] = devId ? await db.select({ id: appDevices.id }).from(appDevices).where(and(eq(appDevices.id, devId), eq(appDevices.userId, u.id))) : [];
    if (mine) await db.update(appDevices).set({ pushToken: token, platform, lastSeenAt: new Date() }).where(eq(appDevices.id, mine.id));
    else await db.insert(appDevices).values({ userId: u.id, platform, pushToken: token, name: str(data.name, 80) || null });
  }
  return NextResponse.json({ ok: true });
}

// Signing out in the app stops pushes to that phone.
export async function DELETE(req: NextRequest) {
  const { data } = await readBody(req);
  const token = str(data.token, 400); if (!token) return jerr("Missing token.");
  const db = await getDb();
  await db.update(appDevices).set({ pushToken: null }).where(eq(appDevices.pushToken, token));
  return NextResponse.json({ ok: true });
}
