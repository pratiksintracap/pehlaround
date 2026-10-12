import "server-only";
import fs from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();
/** A static HTML fragment from /content (ported from the original site, links already clean). */
export function content(name: string) {
  if (process.env.NODE_ENV === "production" && cache.has(name)) return cache.get(name)!;
  const html = fs.readFileSync(path.join(process.cwd(), "content", name + ".html"), "utf8");
  cache.set(name, html);
  return html;
}
