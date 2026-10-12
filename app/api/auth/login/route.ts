import { type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { createSession, log } from "@/lib/auth";
import { readBody, str, safeNext, done, fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  const email = str(data.email, 200).toLowerCase();
  const password = typeof data.password === "string" ? data.password : "";
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  const fallback = u?.role === "admin" ? "/admin" : "/dashboard";
  const next = safeNext(data.next, fallback);
  const back = "/login" + (data.next ? `?next=${encodeURIComponent(next)}` : "");
  if (!u || u.disabled || !(await bcrypt.compare(password, u.passwordHash))) {
    await new Promise((r) => setTimeout(r, 400));
    return fail(req, json, "That email and password do not match.", back, 401);
  }
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await createSession(u.id);
  await log(u, "Signed in");
  return done(req, json, next);
}
