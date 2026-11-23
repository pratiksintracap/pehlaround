import { NextResponse } from "next/server";
import { submitAccessRequest } from "@/lib/credit/server/intake";
import { SITE_URL } from "@/lib/site";

/*
 * The one endpoint the public site talks to. Write-only: it accepts a "request access" submission and
 * returns nothing about anyone. CORS allows only the public site's origin. There is no GET.
 */

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = process.env.PUBLIC_SITE_ORIGIN || new URL(SITE_URL).origin;
  if (!allowed || origin !== allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  if (origin && !headers["Access-Control-Allow-Origin"]) return new NextResponse("Forbidden", { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400, headers });
  }
  const res = await submitAccessRequest(body, ip);
  const status = res.ok ? 200 : res.error.startsWith("Too many") ? 429 : 400;
  return NextResponse.json(res, { status, headers });
}
