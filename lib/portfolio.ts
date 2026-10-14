import type { IpoProgress } from "@/lib/types";

// A family office's holding after allotment: where the company is on the road to listing, the lock-in and the value.

export const STEPS: { key: keyof IpoProgress; label: string }[] = [
  { key: "closed", label: "Round closed" },
  { key: "drhp", label: "Draft offer document filed" },
  { key: "sebi", label: "SEBI observations" },
  { key: "rhp", label: "Price band" },
  { key: "listing", label: "Listed" },
];

const day = (s?: string) => (s ? new Date(s + "T00:00:00+05:30") : null);
export const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—");
export const crore = (rupees: number) => `₹${(rupees / 1e7).toLocaleString("en-IN", { maximumFractionDigits: rupees >= 1e9 ? 0 : 2 })} Cr`;

export type Holding = {
  costRs: number;                    // what the office paid
  shares: number | null; price: number | null;
  steps: { label: string; date: Date | null; done: boolean; now: boolean }[];
  listed: boolean; listingDate: Date | null;
  value: { rs: number; basis: string; multiple: number } | null; // marked value, if a price is known
  band: { rs: number; multiple: number; upper: number } | null;   // value at the top of the price band, before listing
  lockIn: { ends: Date | null; daysLeft: number | null; text: string };
};

export function holding(i: { amountCr: string | number; shares: number | null; price: number | null }, ipo: IpoProgress, now = new Date()): Holding {
  const cost = i.shares && i.price ? i.shares * i.price : Number(i.amountCr) * 1e7;
  const reached = STEPS.map((s) => !!ipo[s.key]);
  const last = reached.lastIndexOf(true);
  const steps = STEPS.map((s, k) => ({ label: s.label, date: day(ipo[s.key] as string | undefined), done: reached[k], now: k === last + 1 }));
  const listingDate = day(ipo.listing);
  const listed = !!listingDate && listingDate <= now;
  const px = ipo.lastPrice ?? (listed ? ipo.listPrice : undefined);
  const value = i.shares && px ? { rs: i.shares * px, basis: ipo.lastPrice ? `₹${ipo.lastPrice} a share${ipo.lastAt ? ` on ${fmtDay(day(ipo.lastAt))}` : ""}` : `listing-day close of ₹${ipo.listPrice}`, multiple: (i.shares * px) / cost } : null;
  const upper = (() => { const m = (ipo.priceBand || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/g); return m ? Math.max(...m.map(Number)) : null; })();
  const band = !listed && i.shares && upper ? { rs: i.shares * upper, multiple: (i.shares * upper) / cost, upper } : null;
  // SEBI ICDR: shares held before an IPO are locked in for six months from the date of allotment in the IPO.
  const ends = ipo.listing ? (() => { const [y, m, d] = ipo.listing.split("-").map(Number); let t = new Date(Date.UTC(y, m - 1 + 6, d)); if (t.getUTCDate() !== d) t = new Date(Date.UTC(y, m - 1 + 7, 0)); return day(t.toISOString().slice(0, 10)); })() : null;
  const daysLeft = ends ? Math.ceil((+ends - +now) / 864e5) : null;
  const lockIn = ends
    ? { ends, daysLeft, text: daysLeft! > 0 ? `Locked in until ${fmtDay(ends)}, ${daysLeft} days from now` : `Lock-in ended on ${fmtDay(ends)}` }
    : { ends: null, daysLeft: null, text: "Six months from the IPO allotment, under SEBI's rules for shares held before an IPO" };
  return { costRs: cost, shares: i.shares, price: i.price, steps, listed, listingDate, value, band, lockIn };
}
