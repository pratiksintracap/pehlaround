import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateHits } from "@/db/schema";
import { clientIp } from "@/lib/auth";

/**
 * Counts attempts per key in a sliding window. Returns false once `max` attempts were made in the last `windowSec`.
 * Works across serverless instances because the count lives in the database.
 */
export async function allow(key: string, max: number, windowSec: number) {
  const db = await getDb();
  const since = new Date(Date.now() - windowSec * 1000);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(rateHits).where(and(eq(rateHits.key, key), gt(rateHits.at, since)));
  if (n >= max) return false;
  await db.insert(rateHits).values({ key });
  if (Math.random() < 0.02) await db.delete(rateHits).where(lt(rateHits.at, new Date(Date.now() - 2 * 86400e3)));
  return true;
}

/** Same, keyed on the caller's IP address. */
export async function allowIp(action: string, max: number, windowSec: number) {
  return allow(`${action}:ip:${(await clientIp()) || "unknown"}`, max, windowSec);
}

/** A hidden form field people never fill; bots usually do. */
export const isBot = (data: Record<string, unknown>) => typeof data.website === "string" && data.website.trim() !== "";
export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
