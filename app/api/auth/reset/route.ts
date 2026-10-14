import { type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { passwordResets, users } from "@/db/schema";
import { createSession, log, signOutEverywhere } from "@/lib/auth";
import { readBody, str, done, fail } from "@/lib/http";
import { allowIp, TOO_MANY } from "@/lib/rate";
import { isDesk } from "@/lib/perm";

export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  const token = str(data.token, 200), pw = typeof data.password === "string" ? data.password : "";
  const back = `/reset?token=${encodeURIComponent(token)}`;
  if (!(await allowIp("reset", 20, 3600))) return fail(req, json, TOO_MANY, back, 429);
  if (pw.length < 8) return fail(req, json, "Choose a password of at least 8 characters.", back);
  if (pw !== data.password2) return fail(req, json, "The two passwords do not match.", back);
  const db = await getDb();
  const hash = createHash("sha256").update(token).digest("hex");
  const [r] = await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, hash), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));
  if (!r) return fail(req, json, "This link has expired or was already used. Ask for a new one.", "/forgot");
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
  await db.update(users).set({ passwordHash: await bcrypt.hash(pw, 10) }).where(eq(users.id, r.userId));
  await signOutEverywhere(r.userId);
  await createSession(r.userId);
  const [u] = await db.select().from(users).where(eq(users.id, r.userId));
  await log(u ? { id: u.id, name: u.name, officeId: u.officeId } : null, "Reset the password; other sign-ins were ended");
  return done(req, json, isDesk(u) ? "/admin" : "/dashboard?msg=" + encodeURIComponent("Password changed. Any other signed-in devices have been signed out."));
}
