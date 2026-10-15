import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { track, readRefCode, type EventKind } from "@/lib/track";
import { allowIp } from "@/lib/rate";
import { RS_COOKIE } from "@/lib/source";

export const dynamic = "force-dynamic";
// Page-level funnel steps the server cannot see on its own: a visit to the register page (once a day per browser)
// and a visit through an office's invite link. Sent by site.js as a beacon; best effort.
const PAGE_KINDS: EventKind[] = ["register_started", "referral_visit"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { k?: string };
  const kind = PAGE_KINDS.find((k) => k === body.k);
  if (!kind) return NextResponse.json({ ok: false }, { status: 400 });
  const jar = await cookies();
  if (jar.get(RS_COOKIE)?.value === kind) return NextResponse.json({ ok: true, dup: true });
  if (!(await allowIp("track", 60, 3600))) return NextResponse.json({ ok: false }, { status: 429 });
  const ref = kind === "referral_visit" ? await readRefCode() : null;
  if (kind === "referral_visit" && !ref) return NextResponse.json({ ok: false }, { status: 400 });
  await track(kind, { meta: ref ? { ref } : undefined });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(RS_COOKIE, kind, { maxAge: 86400, sameSite: "lax", httpOnly: true, path: "/" });
  return res;
}
