import { type NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { passwordResets, users } from "@/db/schema";
import { readBody, str, done, fail } from "@/lib/http";
import { allow, allowIp, isBot, TOO_MANY } from "@/lib/rate";
import { emailReady, notifyDesk, sendEmail } from "@/lib/notify";
import { SITE_URL } from "@/lib/site";

const SENT = "/forgot?sent=1";

export async function POST(req: NextRequest) {
  const { data, json } = await readBody(req);
  if (isBot(data)) return done(req, json, SENT);
  const email = str(data.email, 200).toLowerCase();
  if (!email) return fail(req, json, "Please enter your registered email.", "/forgot");
  if (!(await allowIp("forgot", 8, 3600)) || !(await allow(`forgot:${email}`, 3, 3600))) return fail(req, json, TOO_MANY, "/forgot", 429);
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  // Same answer whether or not the email is registered, so the form can't be used to discover members.
  if (!u || u.disabled) return done(req, json, SENT);
  if (!emailReady()) {
    await notifyDesk({ title: `Password reset requested: ${u.name}`, body: "Email is not set up yet, so a super admin sets a new password for them under Family offices and shares it privately.", link: "/admin/offices" });
    return done(req, json, SENT);
  }
  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({ userId: u.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600e3) });
  await sendEmail([u.email], { title: "Reset your Off Market Desk password",
    body: "Someone (hopefully you) asked to reset the password for this email. The link works once, for one hour. If it wasn't you, ignore this email; your password stays as it is.",
    link: `${SITE_URL}/reset?token=${token}` });
  return done(req, json, SENT);
}
