// Sell-side matching: for a holder who wants to sell unlisted shares (a "seller" lead), which offices on the desk are
// worth a call, and why. Scored only from what an office told the desk in its investment profile and what it has done
// on the desk. Pure, so the scoring is tested without a database. Desk only: nothing here reaches an investor, and
// nothing is sent. No "server-only" here so the tests can import it.

export type SellerLead = { company: string; size: string; sector: string };
export type MatchOffice = { id: number; name: string; investorType: string; ticket: string | null; sectors: string[] | null; structures: string[] | null; aum?: string | null };
export type Match = { officeId: number; name: string; score: number; why: string[] };

/** The size bands on the Sell page, in ₹ crore. */
export const SIZE_CR: Record<string, [number, number]> = { "Under ₹1 Cr": [0, 1], "₹1–5 Cr": [1, 5], "₹5–25 Cr": [5, 25], "Above ₹25 Cr": [25, 1e6] };
/** The ticket bands an office picks in its profile, in ₹ crore. */
export const TICKET_CR: Record<string, [number, number]> = { "₹50 lakh – 1 crore": [0.5, 1], "₹1–2 crore": [1, 2], "₹2–5 crore": [2, 5], "₹5–25 crore": [5, 25], "Above ₹25 crore": [25, 1e6] };

/** Company names compared without their legal endings, so "Acme Industries Pvt. Ltd." matches "Acme Industries Limited". */
export const normCompany = (s: string) => s.toLowerCase().replace(/\b(private|pvt|limited|ltd|india|the)\b\.?/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/** Rank offices for one holding. `knows`: offices that signed the NDA or asked for an allocation in the same company. */
export function matchSeller(lead: SellerLead, offices: MatchOffice[], knows: Set<number>, limit = 10): Match[] {
  const size = SIZE_CR[lead.size];
  const out: Match[] = [];
  for (const o of offices) {
    if (o.investorType === "broker") continue; // a partner firm is not a buyer
    const why: string[] = []; let score = 0;
    if (knows.has(o.id)) { score += 4; why.push("Already in this company's room on the desk"); }
    if ((o.structures || []).includes("Pre-IPO secondary")) { score += 2; why.push("Buys pre-IPO secondaries"); }
    if (lead.sector && (o.sectors || []).includes(lead.sector)) { score += 2; why.push(`Invests in ${lead.sector.toLowerCase()}`); }
    const t = o.ticket ? TICKET_CR[o.ticket] : undefined;
    if (size && t) {
      // The office can take the holding whole, or a meaningful part of it, without going below its own ticket.
      if (t[0] <= size[1] && t[1] >= Math.min(size[0], size[1])) { score += 1; why.push(`Ticket ${o.ticket} suits a ${lead.size.replace("Under ", "sub-")} holding`); }
      else if (t[0] > size[1]) { score -= 2; why.push(`Ticket ${o.ticket} is larger than the holding`); }
    }
    if (o.investorType === "fund" && size && size[0] >= 5) { score += 1; why.push("A fund, for a larger block"); }
    if (score > 0) out.push({ officeId: o.id, name: o.name, score, why });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}
