import { type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { createSession, log } from "@/lib/auth";
import { readBody, str, safeNext, done, fail } from "@/lib/http";
import { allow, allowIp, TOO_MANY } from "@/lib/rate";
import { checkCode, LOGIN } from "@/lib/sign-code";
import { isDesk } from "@/lib/perm";
import { normPhone, userForPhone } from "@/lib/phone-login";

export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  const password = typeof data.password === "string" ? data.password : "";
  const db = await getDb();
  // Sign in with a mobile number and a texted code: only for an approved account that number belongs to (lib/phone-login).
  const phone = normPhone(str(data.phone, 40));
  const byPhone = phone ? await userForPhone(phone) : null;
  const email = phone ? (byPhone?.user.email ?? "") : str(data.email, 200).toLowerCase();
  const [u] = phone ? (byPhone ? [byPhone.user] : []) : await db.select().from(users).where(eq(users.email, email));
  const fallback = isDesk(u) ? "/admin" : u?.role === "promoter" ? "/founder" : "/dashboard";
  const next = safeNext(data.next, fallback);
  const back = "/login" + (data.next ? `?next=${encodeURIComponent(next)}` : "");
  if (!(await allowIp("login", 30, 900)) || !(await allow(phone ? `login:phone:${phone}` : `login:email:${email}`, 10, 900))) return fail(req, json, TOO_MANY, back, 429);
  // Sign in with a code emailed to the person instead of a password.
  const code = str(data.code, 12).replace(/\D/g, "");
  if (phone && !code) return fail(req, json, "Please enter the code we texted you.", back, 400);
  if (code) {
    const r = u && !u.disabled ? await checkCode(u.id, LOGIN, code) : "none";
    if (r !== "ok") {
      await new Promise((res) => setTimeout(res, 400));
      return fail(req, json, r === "wrong" ? (phone ? "That code is not right. Check the latest text from Before the Bell." : "That code is not right. Check the latest email from Before the Bell.") : r === "expired" ? "Too many wrong tries. Send a new code." : "That code has expired. Send a new one.", back, 401);
    }
  } else if (!u || u.disabled || !(await bcrypt.compare(password, u.passwordHash))) {
    await new Promise((r) => setTimeout(r, 400));
    return fail(req, json, "That email and password do not match.", back, 401);
  }
  if (!u) return fail(req, json, "That email and password do not match.", back, 401);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await createSession(u.id);
  await log(u, phone ? "Signed in with a mobile code" : code ? "Signed in with an email code" : "Signed in");
  return done(req, json, next);
}
