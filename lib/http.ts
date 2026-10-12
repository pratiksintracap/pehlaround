import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/** Reads a JSON or form body into a plain object of strings/booleans. */
export async function readBody(req: NextRequest): Promise<{ data: Record<string, unknown>; json: boolean }> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return { data: (await req.json().catch(() => ({}))) as Record<string, unknown>, json: true };
  const fd = await req.formData();
  const data: Record<string, unknown> = {};
  fd.forEach((v, k) => { data[k] = typeof v === "string" ? v : ""; });
  return { data, json: false };
}

export const str = (v: unknown, max = 500) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, max);

/** Only same-site paths are allowed as a "next" destination. */
export function safeNext(v: unknown, fallback = "/dashboard") {
  const s = str(v, 300);
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

/** JSON callers get JSON; plain form posts get a redirect (with ?error= on failure). */
export function done(req: NextRequest, json: boolean, next: string) {
  return json ? NextResponse.json({ ok: true, next }) : NextResponse.redirect(new URL(next, req.url), 303);
}
export function fail(req: NextRequest, json: boolean, error: string, back: string, status = 400) {
  if (json) return NextResponse.json({ error }, { status });
  const u = new URL(back, req.url); u.searchParams.set("error", error);
  return NextResponse.redirect(u, 303);
}
export const jerr = (error: string, status = 400) => NextResponse.json({ error }, { status });
