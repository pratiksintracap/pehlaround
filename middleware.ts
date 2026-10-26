import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_RE, SRC_COOKIE, sourceFrom } from "@/lib/source";

const PRIVATE = /^\/(admin|dashboard|founder)(\/|$)/;
const NINETY_DAYS = 90 * 86400;
// The public website. Once signed in, a person is in the product: these pages send them to their home instead,
// as any app does. Articles, legal pages, support and deal overviews stay reachable (they are linked from emails
// and search). The desk can still look at the public site with ?site=1, which lasts for the browser session.
const MARKETING = /^\/(how-it-works|about|founders|press|webinars|pre-ipo-investing|login|register)?\/?$/;
const PEEK = "pr_peek";

// Two jobs: private areas need a session cookie (pages check the user and role themselves), and the first visit
// is remembered (utm tags, referrer, landing page, an office's invite code) so a registration can be credited to it.
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (PRIVATE.test(url.pathname) && !req.cookies.get("pr_session")) {
    const u = url.clone();
    u.pathname = "/login"; u.search = `?next=${encodeURIComponent(url.pathname)}`;
    return NextResponse.redirect(u);
  }
  const signedIn = !!req.cookies.get("pr_session");
  const peek = url.searchParams.get("site") === "1";
  if (signedIn && MARKETING.test(url.pathname) && !peek && !req.cookies.get(PEEK)) {
    const u = url.clone();
    const next = url.searchParams.get("next");
    u.pathname = "/home"; u.search = next ? `?next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(u);
  }
  const res = NextResponse.next();
  if (signedIn && peek) res.cookies.set(PEEK, "1", { sameSite: "lax", httpOnly: true, path: "/" });
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
