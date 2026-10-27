import { NextResponse, type NextRequest } from "next/server";
import { readBody, str, jerr } from "@/lib/http";
import { allow, allowIp, TOO_MANY } from "@/lib/rate";
import { smsReady, sendCodeSms } from "@/lib/sms";
import { normPhone, maskPhone, userForPhone } from "@/lib/phone-login";
import { issueCode, CODE_MINUTES, LOGIN } from "@/lib/sign-code";

/** Texts a six-digit sign-in code to an approved account's mobile. Answers the same whether or not the number is on one. */
export async function POST(req: NextRequest) {
  const { data } = await readBody(req);
  const phone = normPhone(str(data.phone, 40));
  if (!phone) return jerr("Please enter your mobile number, with the country code if it is not Indian.");
  if (!smsReady()) return jerr("Mobile sign-in is not switched on yet. Please use your email.", 503);
  if (!(await allowIp("phonecode", 15, 3600)) || !(await allow(`phonecode:${phone}`, 4, 3600))) return jerr(TOO_MANY, 429);
  const hit = await userForPhone(phone);
  if (hit) {
    const code = await issueCode(hit.user.id, LOGIN);
    try { await sendCodeSms(hit.phone, code, CODE_MINUTES); }
    catch (e) {
      console.error("[sms]", e);
      return jerr("The text message could not be sent just now. Please use your email, or try again in a minute.", 502);
    }
  } else await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json({ ok: true, minutes: CODE_MINUTES, to: maskPhone(phone) });
}
