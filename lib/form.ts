// One way for a desk form to finish (MODEL.md §7). A server action ends with `done` (it worked) or `fail` (it was
// refused, nothing changed): both go back to the page the form was on, at the form (#hash), carrying the message.
// <FormResult> (components/Form.tsx) shows it there, coloured by outcome, and takes it out of the address bar.
import "server-only";
import { redirect } from "next/navigation";

export type Tone = "ok" | "err";

/** Field readers shared by every action. */
export const str = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
export const num = (f: FormData, k: string) => Number(f.get(k)) || 0;
export const isoDay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** The address a result goes back to: `path`, with the message and tone added before any #hash. */
export function resultUrl(path: string, msg: string, tone: Tone = "ok") {
  const [p, hash] = path.split("#");
  const q = `msg=${encodeURIComponent(msg)}${tone === "err" ? "&tone=err" : ""}`;
  return `${p}${p.includes("?") ? "&" : "?"}${q}${hash ? `#${hash}` : ""}`;
}

export function done(path: string, msg: string): never {
  redirect(resultUrl(path, msg, "ok"));
}
export function fail(path: string, msg: string): never {
  redirect(resultUrl(path, msg, "err"));
}

/** Where a desk form asked to go back to (its hidden `back` field), if it is a desk page; otherwise `fallback`. */
export function deskBack(f: FormData | null, fallback: string) {
  const want = f ? str(f, "back", 500) : "";
  return /^\/(admin|desk)(\/|$|\?)/.test(want) ? want : fallback;
}
