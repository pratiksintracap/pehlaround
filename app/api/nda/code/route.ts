import { NextResponse, type NextRequest } from "next/server";
import { getUser, log } from "@/lib/auth";
import { getDeal, signedDealIds, canSeeNames } from "@/lib/deals";
import { readBody, str, jerr } from "@/lib/http";
import { allow, TOO_MANY } from "@/lib/rate";
import { emailReady, sendRaw, layout, E, esc } from "@/lib/email";
import { issueCode, CODE_MINUTES } from "@/lib/sign-code";

/** Emails the signer a one-time code to sign this company's NDA. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.office) return jerr("Please sign in again.", 401);
  const { data } = await readBody(req);
  const d = await getDeal(str(data.slug, 120));
  if (!d || !d.published || !d.open) return jerr("This room is not open.", 404);
  if ((await signedDealIds(user.office.id)).has(d.id)) return NextResponse.json({ ok: true, signed: true });
  if (!(await canSeeNames(user))) return jerr("Your office is still being approved by the desk.", 403);
  if (!emailReady()) return NextResponse.json({ ok: true, noEmail: true });
  if (!(await allow(`ndacode:${user.id}`, 6, 3600))) return jerr(TOO_MANY, 429);
  const code = await issueCode(user.id, d.id);
  const body = E.h(`Your code: ${code}`) + E.p(`Enter this code on Before the Bell to sign the non-disclosure agreement with <b>${esc(d.company)}</b> on behalf of <b>${esc(user.office.name)}</b>. It works for ${CODE_MINUTES} minutes.`)
    + E.p("If you did not ask for it, ignore this email; nothing is signed without the code.");
  const sent = await sendRaw([user.email], `${code} is your code to sign the ${d.company} NDA`, layout(body, { preheader: `Code ${code}, valid ${CODE_MINUTES} minutes` }));
  if (!sent) return jerr("The code could not be sent. Please try again, or write to the desk.", 502);
  await log(user, `Asked for a signing code: ${d.company}`, d.id);
  const [name, dom] = user.email.split("@");
  return NextResponse.json({ ok: true, to: `${name.slice(0, 2)}${"•".repeat(Math.min(4, Math.max(1, name.length - 2)))}@${dom}` });
}
