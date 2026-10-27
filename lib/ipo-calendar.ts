import DATA from "@/lib/ipo-calendar.json";

// The public IPO calendar: main-board and SME issues, dates and terms as filed. Facts only, no view on any issue.
// lib/ipo-calendar.json is refreshed every week by a scheduled task; each issue moves between sections by date.

export type Ipo = { name: string; board: "Mainboard" | "SME"; exchange?: string; open: string; close: string; allotment?: string; listing?: string; band?: string; sizeCr?: number; lot?: number };
export type Phase = "open" | "soon" | "closed" | "listed";

export const IPO_DATA = DATA as { asOf: string; entries: Ipo[]; sources: { title: string; url: string }[] };

/** Today in India as YYYY-MM-DD. */
export const istToday = (now = new Date()) => new Date(+now + 5.5 * 36e5).toISOString().slice(0, 10);

/** Where an issue stands on a given day: opening soon, open now, closed and waiting to list, or listed. */
export function phase(i: Ipo, today: string): Phase {
  if (today < i.open) return "soon";
  if (today <= i.close) return "open";
  if (i.listing && today >= i.listing) return "listed";
  return "closed";
}

export function calendar(today = istToday()) {
  const out: Record<Phase, Ipo[]> = { open: [], soon: [], closed: [], listed: [] };
  const monthAgo = new Date(Date.parse(today) - 30 * 864e5).toISOString().slice(0, 10);
  for (const i of IPO_DATA.entries) {
    const p = phase(i, today);
    if (p === "listed" && (i.listing ?? "") < monthAgo) continue;
    out[p].push(i);
  }
  out.open.sort((a, b) => a.close.localeCompare(b.close));
  out.soon.sort((a, b) => a.open.localeCompare(b.open));
  out.closed.sort((a, b) => (a.listing ?? "9").localeCompare(b.listing ?? "9"));
  out.listed.sort((a, b) => (b.listing ?? "").localeCompare(a.listing ?? ""));
  return out;
}

export const fmtDay = (d?: string) => (d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "To be announced");
