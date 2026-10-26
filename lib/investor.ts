/** Who is on the desk: family offices, funds and individual investors. Shared by registration, the admin and the counter. */
export type InvestorType = "family_office" | "fund" | "individual" | "broker";
export const TYPE_LABEL: Record<InvestorType, string> = { family_office: "Family office", fund: "Fund", individual: "Individual investor", broker: "Broker / wealth manager" };
export const DECL_LABEL: Record<string, string> = { accredited: "accredited investor (declared)", min_ticket_25l: "₹25 lakh minimum per company (declared)" };
/** SEBI-registered AIFs are qualified institutional buyers, which the Companies Act's 200-offeree limit does not count.
 *  PMS and other funds are counted, so only the AIF categories are left out. */
export const isQib = (o: { investorType?: string | null; category?: string | null }) => o.investorType === "fund" && /^AIF/i.test(o.category || "");
/** The Indian financial year containing d, as its first day (1 April) and a label like "FY27". */
export function finYear(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600e3);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return { start: new Date(Date.UTC(y, 3, 1) - 5.5 * 3600e3), label: `FY${String(y + 1).slice(-2)}` };
}
export const OFFEREE_LIMIT = 200, OFFEREE_WARN = 150;
