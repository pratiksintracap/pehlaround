import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { signCodes } from "@/db/schema";

const secret = () => process.env.SESSION_SECRET || process.env.DATABASE_URL || "omd-local-dev";
const hash = (userId: number, dealId: number, code: string) => createHmac("sha256", secret()).update(`nda|${userId}|${dealId}|${code}`).digest("hex");
export const CODE_MINUTES = 10;

/** A fresh six-digit code for this person and deal; earlier unused codes stop working. */
export async function issueCode(userId: number, dealId: number) {
  const db = await getDb();
  await db.update(signCodes).set({ usedAt: new Date() }).where(and(eq(signCodes.userId, userId), eq(signCodes.dealId, dealId), isNull(signCodes.usedAt)));
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(signCodes).values({ userId, dealId, codeHash: hash(userId, dealId, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60e3) });
  return code;
}

/** Checks a code; five wrong tries end it. Returns "ok", "wrong", "expired" or "none". */
export async function checkCode(userId: number, dealId: number, code: string) {
  const db = await getDb();
  const [c] = await db.select().from(signCodes).where(and(eq(signCodes.userId, userId), eq(signCodes.dealId, dealId), isNull(signCodes.usedAt), gt(signCodes.expiresAt, new Date())))
    .orderBy(desc(signCodes.createdAt)).limit(1);
  if (!c) return "none" as const;
  if (c.attempts >= 5) return "expired" as const;
  const want = Buffer.from(c.codeHash, "hex"), got = Buffer.from(hash(userId, dealId, code.replace(/\D/g, "")), "hex");
  if (want.length === got.length && timingSafeEqual(want, got)) { await db.update(signCodes).set({ usedAt: new Date() }).where(eq(signCodes.id, c.id)); return "ok" as const; }
  await db.update(signCodes).set({ attempts: c.attempts + 1 }).where(eq(signCodes.id, c.id));
  return "wrong" as const;
}
