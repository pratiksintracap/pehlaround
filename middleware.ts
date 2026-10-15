import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_RE, SRC_COOKIE, sourceFrom } from "@/lib/source";

const PRIVATE = /^\/(admin|dashboard|founder)(\/|$)/;
const NINETY_DAYS = 90 * 86400;

// Two jobs: private areas need a session cookie (pages check the user and role themselves), and the first visit
// is remembered (utm tags, referrer, landing page, an office's invite code) so a registration can be credited to it.
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (PRIVATE.test(url.pathname) && !req.cookies.get("pr_session")) {
    const u = url.clone();
    u.pathname = "/login"; u.search = `?next=${encodeURIComponent(url.pathname)}`;
    return NextResponse.redirect(u);
  }
  const res = NextResponse.next();
  const q = url.searchParams;
  const ref = q.get("ref");
  if (ref && REF_RE.test(ref)) res.cookies.set(REF_COOKIE, ref.toLowerCase(), { maxAge: NINETY_DAYS, sameSite: "lax", httpOnly: true, path: "/" });
  const tagged = q.has("utm_source") || q.has("utm_medium") || q.has("utm_campaign");
  // First touch wins, except that a tagged link (an email, a post) always records its tags.
  if (tagged || !req.cookies.get(SRC_COOKIE)) {
    const src = sourceFrom(url, req.headers.get("referer"));
    if (src) res.cookies.set(SRC_COOKIE, JSON.stringify(src), { maxAge: NINETY_DAYS, sameSite: "lax", httpOnly: true, path: "/" });
  }
  return res;
}
// Pages only: not Next internals, the API, or files.
export const config = { matcher: ["/((?!_next|api/|.*\\.[a-z0-9]+$).*)"] };
