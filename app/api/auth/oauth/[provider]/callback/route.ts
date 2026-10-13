import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { provider, finish } from "@/lib/oauth";
import { createSession, log, signTemp, verifyTemp, OAUTH_PENDING } from "@/lib/auth";
import { allowIp, TOO_MANY } from "@/lib/rate";

type Tx = { state: string; verifier: string; nonce: string; next: string; provider: string };

/** The provider sends the browser back here: sign in an existing person, or carry a new one to registration. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const id = (await params).provider, p = provider(id);
  const q = req.nextUrl.searchParams;
  const oops = (m: string) => { const r = NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(m), req.url), 303); r.cookies.delete({ name: "omd_oauth_tx", path: "/api/auth/oauth" }); return r; };
  if (!p) return oops("That sign-in option is not switched on.");
  if (!(await allowIp("oauth", 30, 900))) return oops(TOO_MANY);
  const tx = await verifyTemp<Tx>(req.cookies.get("omd_oauth_tx")?.value);
  if (q.get("error")) return oops(`${p.name} sign-in was cancelled.`);
  if (!tx || tx.provider !== p.id || !q.get("state") || tx.state !== q.get("state") || !q.get("code")) return oops("The sign-in expired. Please try again.");
  const out = await finish(p, q.get("code")!, tx.verifier, tx.nonce, `${req.nextUrl.origin}/api/auth/oauth/${p.id}/callback`);
  if ("error" in out) return oops(out.error as string);

  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, out.email));
  if (u) {
    if (u.disabled) return oops("This account is switched off. Please write to the desk.");
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
    await createSession(u.id);
    await log(u, `Signed in with ${p.name}`);
    const r = NextResponse.redirect(new URL(tx.next || (u.role === "admin" ? "/admin" : "/dashboard"), req.url), 303);
    r.cookies.delete({ name: "omd_oauth_tx", path: "/api/auth/oauth" });
    return r;
  }
  // New to the desk: registration opens with this confirmed email, and no password is needed.
  const r = NextResponse.redirect(new URL(`/register?via=${p.id}${tx.next ? `&next=${encodeURIComponent(tx.next)}` : ""}`, req.url), 303);
  r.cookies.set(OAUTH_PENDING, await signTemp({ email: out.email, name: out.name, provider: p.name }, 30), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 1800 });
  r.cookies.delete({ name: "omd_oauth_tx", path: "/api/auth/oauth" });
  return r;
}
