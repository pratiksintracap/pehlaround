// The desk's researched peer comparisons, one per deal slug. A room shows room.compare when the desk has
// edited one in the console, otherwise the default here. Listed-peer figures are public; the company's own
// figures are the ones already shown in its room.
import type { PeerCompare } from "../types";
import krasny from "./naval-defence-secondary.json";
import jandani from "./jewellery-pre-ipo.json";
import armsoftech from "./ai-collections-software.json";
import karthik from "./ethanol-distillery-pre-ipo.json";
import royal from "./edible-oils-pre-ipo.json";
import lahs from "./waste-management-growth-round.json";

const DEFAULTS: Record<string, unknown> = {
  "naval-defence-secondary": krasny,
  "jewellery-pre-ipo": jandani,
  "ai-collections-software": armsoftech,
  "ethanol-distillery-pre-ipo": karthik,
  "edible-oils-pre-ipo": royal,
  "waste-management-growth-round": lahs,
};

/** The comparison to show in a room: the desk's own edit first, then the researched default. Null when neither is usable. */
export function peerCompareFor(slug: string, own?: PeerCompare | null): PeerCompare | null {
  for (const c of [own, DEFAULTS[slug]]) {
    if (!c) continue;
    try { return checkCompare(c); } catch { /* fall through */ }
  }
  return null;
}

/** Validates a comparison's shape; throws with a message the console can show. */
export function checkCompare(raw: unknown): PeerCompare {
  const c = raw as PeerCompare;
  const fail = (m: string) => { throw new Error(`Peer comparison: ${m}`); };
  if (!c || typeof c !== "object") fail("not an object");
  if (!Array.isArray(c.companies) || c.companies.length < 2) fail("needs the company and at least one peer in companies");
  const n = c.companies.length;
  for (const k of ["metrics", "dims", "matrix", "barriers", "sources"] as const) if (!Array.isArray(c[k])) fail(`${k} must be a list`);
  if (!c.stands || !Array.isArray(c.stands.ahead) || !Array.isArray(c.stands.behind) || !Array.isArray(c.stands.watch)) fail("stands needs ahead, behind and watch lists");
  c.metrics.forEach((m) => { if (!Array.isArray(m.vals) || m.vals.length !== n) fail(`metric “${m.label}” needs ${n} values`); if (m.vals.some((v) => v !== null && typeof v !== "number")) fail(`metric “${m.label}” has a value that is not a number`); });
  c.dims.forEach((d) => { if (!Array.isArray(d.scores) || d.scores.length !== n) fail(`dimension “${d.name}” needs ${n} scores`); });
  c.matrix.forEach((r) => { if (!Array.isArray(r.cells) || r.cells.length !== n) fail(`row “${r.aspect}” needs ${n} cells`); });
  return c;
}
