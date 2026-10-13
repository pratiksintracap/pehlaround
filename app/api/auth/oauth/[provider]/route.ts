import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { provider } from "@/lib/oauth";
import { signTemp } from "@/lib/auth";
import { safeNext } from "@/lib/http";

const b64 = (b: Buffer) => b.toString("base64url");

/** Starts "Continue with Google / Microsoft": sends the browser to the provider with PKCE, state and nonce. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const p = provider((await params).provider);
  if (!p) return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("That sign-in option is not switched on."), req.url), 303);
  const next = safeNext(req.nextUrl.searchParams.get("next"), "");
  const state = b64(randomBytes(18)), verifier = b64(randomBytes(32)), nonce = b64(randomBytes(18));
  const redirectUri = `${req.nextUrl.origin}/api/auth/oauth/${p.id}/callback`;
  const u = new URL(p.auth);
  u.search = new URLSearchParams({
    client_id: p.clientId, response_type: "code", scope: p.scope, redirect_uri: redirectUri, state, nonce,
    code_challenge: b64(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(u, 303);
  res.cookies.set("omd_oauth_tx", await signTemp({ state, verifier, nonce, next, provider: p.id }, 10), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/oauth", maxAge: 600 });
  return res;
}
