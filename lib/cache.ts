import "server-only";
import { unstable_cache } from "next/cache";

/** Public site data (deals, articles, settings) is served from Vercel's data cache, so visitors and link-preview
 *  bots rarely wait on the database. Every admin change clears it (see `back` in admin-actions). */
export const PUBLIC_TAG = "public-data";
const TTL = 300;

// The cache stores JSON, so timestamps come back as strings; turn `...At` fields back into Dates.
function revive<T>(v: T): T {
  if (Array.isArray(v)) return v.map(revive) as T;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      const x = o[k];
      if (typeof x === "string" && /At$/.test(k) && /^\d{4}-\d\d-\d\dT/.test(x)) o[k] = new Date(x);
      else if (x && typeof x === "object" && !(x instanceof Date)) revive(x);
    }
  }
  return v;
}

export function cachedPublic<A extends unknown[], R>(fn: (...a: A) => Promise<R>, key: string) {
  const c = unstable_cache(fn, ["v1", key], { tags: [PUBLIC_TAG], revalidate: TTL });
  return async (...a: A): Promise<R> => revive(await c(...a));
}
