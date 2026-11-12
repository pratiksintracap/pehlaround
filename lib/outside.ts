// An office's holdings outside the desk, and the companies it follows: totals at the office's own prices, matching a
// company to the public IPO calendar by name, the lock-in that follows from a listing, and reading a broker's holdings
// file. Pure, so it is tested without a database. No "server-only" here so the tests can import it.
import type { Ipo, Phase } from "@/lib/ipo-calendar";
import { phase } from "@/lib/ipo-calendar";

export type Outside = { id: number; kind: string; company: string; symbol: string | null; shares: number | null; costPerShare: number | null; valuePerShare: number | null; valuedOn: string | null; boughtOn: string | null; source: string };

/** Names compared without legal endings, punctuation or case: "Acme Industries Pvt. Ltd." = "ACME INDUSTRIES LIMITED". */
export const normName = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/\b(private|pvt|limited|ltd|india|the|co|company|corp|corporation)\b\.?/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/** The calendar issue for a company name, if any: exact after normalising, else one name starting with the other. */
export function findIssue(name: string, entries: Ipo[]): Ipo | null {
  const n = normName(name);
  if (n.length < 3) return null;
  return entries.find((e) => normName(e.name) === n) ?? entries.find((e) => { const m = normName(e.name); return m.length >= 5 && n.length >= 5 && (m.startsWith(n) || n.startsWith(m)); }) ?? null;
}

export const STAGE_TEXT: Record<Phase, string> = { soon: "IPO dates announced", open: "IPO open now", closed: "IPO closed, listing awaited", listed: "Listed" };

/** Shares held before an IPO are locked in after it: six months from allotment on the main board, one year on SME. */
export function lockInEnds(i: Ipo): string | null {
  const from = i.allotment ?? i.listing;
  if (!from) return null;
  const [y, m, d] = from.split("-").map(Number);
  const months = i.board === "SME" ? 12 : 6;
  let t = new Date(Date.UTC(y, m - 1 + months, d));
  if (t.getUTCDate() !== d) t = new Date(Date.UTC(y, m - 1 + months + 1, 0));
  return t.toISOString().slice(0, 10);
}

/** What a holding stands at: cost, the office's own value (cost when it gave none) and the change. Rupees. */
export function worth(h: Pick<Outside, "shares" | "costPerShare" | "valuePerShare">) {
  const sh = h.shares ?? 0;
  const cost = sh * (h.costPerShare ?? 0);
  const valued = h.valuePerShare != null && h.valuePerShare > 0;
  const value = valued ? sh * h.valuePerShare! : cost;
  return { cost, value, valued, change: valued && cost ? (value - cost) / cost : null };
}
export function totals(hs: Outside[]) {
  const w = hs.map(worth);
  const cost = w.reduce((t, x) => t + x.cost, 0), value = w.reduce((t, x) => t + x.value, 0);
  return { cost, value, change: cost ? (value - cost) / cost : null, unvalued: w.filter((x) => !x.valued).length };
}
export const rupees = (n: number) => n >= 1e7 ? `₹${(n / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr` : n >= 1e5 ? `₹${(n / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh` : `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Every stage a company has reached by today: what an office counts as told once it hears where it stands. */
export function seenThrough(i: Ipo, today: string): Phase[] {
  const order: Phase[] = ["soon", "open", "closed", "listed"];
  return order.slice(0, order.indexOf(phase(i, today)) + 1);
}

/** The stages of a followed company the office has not been told about yet, oldest first. */
export function newStages(i: Ipo, told: string[], today: string): Phase[] {
  const order: Phase[] = ["soon", "open", "closed", "listed"];
  const now = phase(i, today);
  // Following a company already past a stage tells only the stage it is at now, not its history.
  return told.length ? order.slice(0, order.indexOf(now) + 1).filter((p) => !told.includes(p)) : [now];
}

// ---------------------------------------------------------------- a broker's holdings file
export type Row = { company: string; symbol: string | null; isin: string | null; shares: number; costPerShare: number | null; valuePerShare: number | null };
const COLS: Record<keyof Omit<Row, "valuePerShare"> | "value" | "ltp", RegExp> = {
  company: /^(company|company name|name|stock|stock name|scrip|scrip name|security|security name|instrument)$/,
  symbol: /^(symbol|trading ?symbol|ticker|scrip code|nse symbol|bse code)$/,
  isin: /^isin( code)?$/,
  shares: /^(qty|quantity|qty\.?|shares|no\.? of shares|holding|holdings|balance|free qty|total qty|available qty|quantity available)$/,
  costPerShare: /^(avg\.? ?(cost|price|buy price)?|average (cost|price|buy price)|buy (avg|price)|cost price|purchase price|avg\.? cost price)$/,
  ltp: /^(ltp|last price|close|closing price|cmp|current price|market price|prev\.? close)$/,
  value: /^(current value|market value|cur\.? val|value|present value|valuation)$/,
};
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[₹,\s]/g, "").replace(/^\((.*)\)$/, "-$1")); return isFinite(n) ? n : NaN; };

/** Rows from a broker's holdings export (rows of cells, the header row anywhere in the first ten). Lines without a
 *  name or a positive quantity are skipped. The file's own price (LTP or value ÷ quantity) becomes the current value. */
export function readHoldings(rows: unknown[][]): { rows: Row[]; skipped: number; error?: string } {
  const clean = (c: unknown) => String(c ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[()]/g, "").replace(/ ?rs\.?$| ?inr$| ?₹$/, "").trim();
  let hi = -1, idx: Partial<Record<keyof typeof COLS, number>> = {};
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const m: typeof idx = {};
    rows[r].forEach((c, k) => { const h = clean(c); for (const [key, re] of Object.entries(COLS)) if (m[key as keyof typeof COLS] === undefined && re.test(h)) m[key as keyof typeof COLS] = k; });
    if ((m.company !== undefined || m.symbol !== undefined || m.isin !== undefined) && m.shares !== undefined) { hi = r; idx = m; break; }
  }
  if (hi < 0) return { rows: [], skipped: 0, error: "Could not find the columns. The file needs a name, symbol or ISIN column and a quantity column." };
  const out: Row[] = []; let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const g = (k: keyof typeof COLS) => (idx[k] === undefined ? "" : String(r[idx[k]!] ?? "").trim());
    const symbol = g("symbol") || null, isin = /^IN[A-Z0-9]{10}$/i.test(g("isin")) ? g("isin").toUpperCase() : null;
    const company = g("company") || symbol || isin || "";
    const shares = num(g("shares"));
    if (!company || !(shares > 0) || /^total/i.test(company)) { skipped++; continue; }
    const cost = num(g("costPerShare")), ltp = num(g("ltp")), value = num(g("value"));
    out.push({ company: company.slice(0, 160), symbol: symbol?.slice(0, 40) ?? null, isin, shares,
      costPerShare: cost > 0 ? cost : null, valuePerShare: ltp > 0 ? ltp : value > 0 ? value / shares : null });
  }
  return { rows: out.slice(0, 500), skipped };
}

/** A CSV file as rows of cells (quoted fields, commas, tabs or semicolons). */
export function csvRows(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", "\t", ";"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
