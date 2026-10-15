/** Where a visitor came from: utm tags, a referral code, the referring site and the landing page.
 *  Kept short because it lives in a cookie. Shared by the middleware (edge) and the server, so no server-only imports here. */
export type Source = { s?: string; m?: string; c?: string; t?: string; r?: string; ref?: string; l?: string; at?: string };
export const SRC_COOKIE = "btb_src";   // first touch, 90 days
export const REF_COOKIE = "btb_ref";   // an office's invite code, 90 days
export const RS_COOKIE = "btb_rs";     // "register page seen", one day: counts a visit once
export const REF_RE = /^[a-z0-9]{6,12}$/i;
const clean = (v: string | null, max = 60) => (v ? v.replace(/[^\w .\-]/g, "").trim().slice(0, max) : "") || undefined;

/** The source for this request, or null when nothing worth keeping is in it. */
export function sourceFrom(url: URL, referer: string | null): Source | null {
  const q = url.searchParams;
  const src: Source = { s: clean(q.get("utm_source")), m: clean(q.get("utm_medium")), c: clean(q.get("utm_campaign")), t: clean(q.get("utm_content")) };
  const ref = q.get("ref");
  if (ref && REF_RE.test(ref)) src.ref = ref.toLowerCase();
  if (referer) { try { const h = new URL(referer).hostname.replace(/^www\./, ""); if (h && !/beforethebell\.in$|localhost|offmarketdesk\.in$/.test(h)) src.r = h.slice(0, 80); } catch { /* ignore */ } }
  src.l = url.pathname.slice(0, 80);
  src.at = new Date().toISOString().slice(0, 10);
  return src;
}
/** A one-line label for reports: "linkedin / social / oct-launch", "referral", "google.com", "direct". */
export function sourceLabel(src: Source | null | undefined) {
  if (!src) return "direct";
  if (src.s || src.m || src.c) return [src.s, src.m, src.c].filter(Boolean).join(" / ");
  if (src.ref) return "referral link";
  if (src.r) return src.r;
  return "direct";
}
