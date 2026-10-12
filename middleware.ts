import { NextResponse, type NextRequest } from "next/server";

// First line of defence: private areas need a session cookie. Pages check the user and role themselves.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("pr_session")) {
    const u = req.nextUrl.clone();
    u.pathname = "/login"; u.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(u);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/dashboard/:path*"] };
