/** Exact two-decimal arithmetic on numeric strings (amounts in rupees, rates in % p.a.). */

export const AMOUNT_RE = /^\d{1,16}(\.\d{1,2})?$/;
export const RATE_RE = /^\d{1,3}(\.\d{1,2})?$/;

export function toHundredths(v: string): bigint {
  const [i, f = ""] = v.split(".");
  return BigInt(i) * 100n + BigInt((f + "00").slice(0, 2));
}

export function fromHundredths(h: bigint): string {
  const neg = h < 0n;
  const a = neg ? -h : h;
  return `${neg ? "-" : ""}${a / 100n}.${(a % 100n).toString().padStart(2, "0")}`;
}

export function sub(a: string, b: string): string {
  return fromHundredths(toHundredths(a) - toHundredths(b));
}

export function add(a: string, b: string): string {
  return fromHundredths(toHundredths(a) + toHundredths(b));
}

export function cmp(a: string, b: string): number {
  const d = toHundredths(a) - toHundredths(b);
  return d < 0n ? -1 : d > 0n ? 1 : 0;
}

/** ₹ with Indian digit grouping. */
export function formatINR(v: string | null | undefined): string {
  if (v == null) return "—";
  const [i, f] = fromHundredths(toHundredths(v)).split(".");
  const last3 = i.slice(-3);
  const rest = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${rest ? rest + "," : ""}${last3}${f === "00" ? "" : "." + f}`;
}

export function formatRate(v: string | null | undefined): string {
  return v == null ? "—" : `${fromHundredths(toHundredths(v))}%`;
}
