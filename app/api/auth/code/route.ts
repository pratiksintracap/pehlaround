import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { readBody, str, jerr } from "@/lib/http";
import { allow, allowIp, TOO_MANY } from "@/lib/rate";
import { emailReady, sendRaw, layout, E } from "@/lib/email";
import { issueCode, CODE_MINUTES, LOGIN } from "@/lib/sign-code";

/** Emails a six-digit sign-in code. Answers the same whether or not the email is registered. */
export async function POST(req: NextRequest) {
  const { data } = await readBody(req);
  const email = str(data.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jerr("Please enter your email address.");
  if (!emailReady()) return jerr("Sign-in codes are not switched on yet. Please use your password.", 503);
  if (!(await allowIp("logincode", 20, 3600)) || !(await allow(`logincode:${email}`, 5, 3600))) return jerr(TOO_MANY, 429);
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (u && !u.disabled) {
    const code = await issueCode(u.id, LOGIN);
    const body = E.h(`Your sign-in code: ${code}`) + E.p(`Enter it on Before the Bell to sign in as ${email}. It works for ${CODE_MINUTES} minutes.`)
      + E.p("If you did not ask for it, ignore this email; nobody can sign in without the code.");
    await sendRaw([email], `${code} is your Before the Bell sign-in code`, layout(body, { preheader: `Code ${code}, valid ${CODE_MINUTES} minutes` }), [], undefined, { kind: "code", userId: u.id });
  } else await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json({ ok: true, minutes: CODE_MINUTES });
}
