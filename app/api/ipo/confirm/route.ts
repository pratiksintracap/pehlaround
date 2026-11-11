import { NextResponse, type NextRequest } from "next/server";
import { readBody, str } from "@/lib/http";
import { allowIp } from "@/lib/rate";
import { answerProposal, proposalByToken } from "@/lib/ipo-proposal";

/** The client's answer from the personal link it was emailed: confirm or decline. No sign-in; the link is the key,
 *  works once, and only a button press (never opening the link) answers it. */
export async function POST(req: NextRequest) {
  const { data } = await readBody(req);
  const token = str(data.token, 80);
  const back = (m: string, ok: boolean) => NextResponse.redirect(new URL(`/ipo/confirm/done?${ok ? "msg" : "error"}=${encodeURIComponent(m)}`, req.url), 303);
  if (!(await allowIp("ipo-confirm", 30, 3600))) return back("Too many attempts. Please try again later.", false);
  const b = await proposalByToken(token);
  if (!b) return back("This link has already been used, or is no longer valid.", false);
  const r = await answerProposal(b.id, data.answer === "confirm", null);
  return back(r.msg, r.ok);
}
