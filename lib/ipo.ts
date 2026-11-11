// The IPO leg: once a company on the desk files its price-band prospectus, approved offices can register interest in
// the public issue. An indication is not an application: every office applies through its own broker, on the terms of
// the prospectus. Pure, so the rules are tested without a database. No "server-only" here so the tests can import it.
import type { IpoProgress } from "@/lib/types";

export type IpoStage = "none" | "open" | "closed" | "listed";
const today = (now: Date) => new Date(now.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10); // the date in India

/** Where the public issue is. Nothing is shown before the prospectus with the price band is filed (`rhp`):
 *  open   = prospectus filed, the issue has not closed: offices may register interest;
 *  closed = the issue has closed, listing awaited: interest is kept, no new ones;
 *  listed = trading. */
export function ipoStage(ipo: IpoProgress | null | undefined, now = new Date()): IpoStage {
  const t = today(now);
  if (!ipo?.rhp || ipo.rhp > t) return "none";
  if (ipo.listing && ipo.listing <= t) return "listed";
  if (ipo.closes && ipo.closes < t) return "closed";
  return "open";
}
/** Shown on investor and partner surfaces: from the prospectus until the listing. */
export const ipoLive = (ipo: IpoProgress | null | undefined, now = new Date()) => { const s = ipoStage(ipo, now); return s === "open" || s === "closed"; };

export type IpoCategory = "anchor" | "qib" | "hni" | "individual";
export const IPO_CATEGORY: Record<IpoCategory, { label: string; note: string }> = {
  anchor: { label: "Anchor investor", note: "Qualified institutional buyers only; allocated before the issue opens" },
  qib: { label: "Qualified institutional buyer", note: "Funds and institutions registered as QIBs" },
  hni: { label: "Non-institutional investor", note: "Larger applications by individuals, family offices and companies" },
  individual: { label: "Individual investor", note: "The individual category, within its application limit" },
};
/** The categories an office may choose: the institutional ones only for a SEBI-registered AIF (a QIB). */
export function categoriesFor(o: { investorType?: string | null; category?: string | null }): IpoCategory[] {
  const qib = o.investorType === "fund" && /^AIF/i.test(o.category || "");
  return qib ? ["anchor", "qib"] : o.investorType === "individual" ? ["individual", "hni"] : ["hni", "individual"];
}

export const IPO_STATUS = ["Indicated", "With the lead manager", "Applied", "Allotted", "Withdrawn"] as const;
export type IpoStatus = (typeof IPO_STATUS)[number];
/** Entered for a client by its partner firm and not yet confirmed by the client. Not interest until it is. */
export const AWAITING = "Awaiting client";
/** Interest that counts: confirmed by the office itself and not withdrawn. */
export const counts = (b: { status: string }) => b.status !== "Withdrawn" && b.status !== AWAITING;
/** The public issues to show: deals on the shelf plus IPO-only deals, from the prospectus until the listing. */
export const ipoVisible = <T extends { published: boolean; ipoOnly: boolean; ipo: IpoProgress }>(all: T[], now = new Date()) => all.filter((d) => (d.published || d.ipoOnly) && ipoLive(d.ipo, now));

/** Amounts are typed in ₹ lakh (individual applications are small) and kept in ₹ crore like every other amount. */
export const lakhToCr = (lakh: number) => Math.round(lakh * 100) / 10000;
export const fmtAmount = (cr: number | string) => { const n = Number(cr); return n >= 1 ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr` : `₹${(n * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`; };
/** The least and most the form accepts for a category, in ₹ lakh. Wide on purpose: the prospectus sets the real limits. */
export const amountRange = (c: IpoCategory): [number, number] => (c === "individual" ? [1, 25] : c === "hni" ? [2, 5000] : [100, 50000]);

export const IPO_DISCLAIMER = "Registering interest is not an application or a bid and reserves no shares. You apply only through your own broker or bank, on the terms of the prospectus; read it before you apply. Anchor allocation is decided by the company and its lead manager.";
