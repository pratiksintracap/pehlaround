"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestLoginCode, verifyLoginCode, completeTotp, destroySession, SESSION_TTL_MS } from "@/lib/credit/server/auth";
import { PRE_SESSION_COOKIE, SESSION_COOKIE, cookieOptions, requestIp } from "@/lib/credit/server/session";

// The email being signed in is kept in a short-lived httpOnly cookie, never in the URL.
const EMAIL_COOKIE = process.env.NODE_ENV === "production" ? "__Host-credit_login_email" : "credit_login_email";

/**
 * Runs a sign-in step. If the platform itself fails (database or mail unreachable), the person gets a plain
 * "try again shortly" message on the same page instead of a crash. redirect() is always called outside the try,
 * because it works by throwing.
 */
async function attempt<T>(step: string, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    console.error(`[login] ${step} failed`, e);
    return { ok: false };
  }
}

export async function requestCodeAction(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const ip = await requestIp();
  const r = await attempt("request code", () => requestLoginCode(email, ip));
  if (!r.ok) redirect("/credit/login?error=unavailable");
  (await cookies()).set(EMAIL_COOKIE, email, cookieOptions(15 * 60));
  redirect("/credit/login/code");
}

export async function verifyCodeAction(fd: FormData) {
  const jar = await cookies();
  const email = jar.get(EMAIL_COOKIE)?.value;
  if (!email) redirect("/credit/login");
  const ua = (await headers()).get("user-agent");
  const ip = await requestIp();
  const r = await attempt("verify code", () => verifyLoginCode(email, String(fd.get("code") ?? "").trim(), ip, ua));
  if (!r.ok) redirect("/credit/login/code?error=unavailable");
  const pre = r.value;
  if (!pre) redirect("/credit/login/code?error=1");
  jar.delete(EMAIL_COOKIE);
  if (pre.stage === "active") {
    jar.set(SESSION_COOKIE, pre.token, cookieOptions(SESSION_TTL_MS / 1000));
    redirect("/");
  }
  jar.set(PRE_SESSION_COOKIE, pre.token, cookieOptions(15 * 60));
  redirect("/credit/login/authenticator");
}

export async function verifyTotpAction(fd: FormData) {
  const jar = await cookies();
  const pre = jar.get(PRE_SESSION_COOKIE)?.value;
  if (!pre) redirect("/credit/login");
  const ua = (await headers()).get("user-agent");
  const ip = await requestIp();
  const r = await attempt("verify authenticator", () => completeTotp(pre, String(fd.get("code") ?? ""), ip, ua));
  if (!r.ok) redirect("/credit/login/authenticator?error=unavailable");
  const token = r.value;
  if (!token) redirect("/credit/login/authenticator?error=1");
  jar.delete(PRE_SESSION_COOKIE);
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS / 1000));
  redirect("/");
}

export async function signOutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await attempt("sign out", () => destroySession(token));
  jar.delete(SESSION_COOKIE);
  redirect("/credit/login");
}
