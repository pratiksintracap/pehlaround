import { type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { createSession, log } from "@/lib/auth";
import { readBody, str, safeNext, done, fail } from "@/lib/http";
import { allow, allowIp, TOO_MANY } from "@/lib/rate";

export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  const email = str(data.email, 200).toLowerCase();
  const password = typeof data.password === "string" ? data.password : "";
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  const fallback = u?.role === "admin" ? "/admin" : "/dashboard";
  const next = safeNext(data.next, fallback);
  const back = "/login" + (data.next ? `?next=${encodeURIComponent(next)}` : "");
  if (!(await allowIp("login", 30, 900)) || !(await allow(`login:email:${email}`, 10, 900))) return fail(req, json, TOO_MANY, back, 429);
  if (!u || u.disabled || !(await bcrypt.compare(password, u.passwordHash))) {
    await new Promise((r) => setTimeout(r, 400));
    return fail(req, json, "That email and password do not match.", back, 401);
  }
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await createSession(u.id);
  await log(u, "Signed in");
  return done(req, json, next);
}
