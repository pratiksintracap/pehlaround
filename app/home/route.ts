import { NextResponse, type NextRequest } from "next/server";
import { getUser, destroySession } from "@/lib/auth";

// Where a signed-in person lands. The marketing pages send signed-in visitors here (see middleware), and the
// dashboard sends each role on to its own home: the desk to the console (or the phone desk), a promoter to
// their company, an investor to their office. A stale session is cleared so the public site shows again.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    await destroySession();
    return NextResponse.redirect(new URL("/", req.url), 303);
  }
  const next = req.nextUrl.searchParams.get("next") || "";
  const safe = /^\/(?![\/\\])/.test(next) && !/^\/home(\/|$|\?)/.test(next) ? next : "/dashboard";
  return NextResponse.redirect(new URL(safe, req.url), 303);
}
