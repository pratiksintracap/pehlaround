// Partner firms (offices of type "broker") and their relationship managers: who sees which clients, and how progress
// against the desk's target for an issue is counted. Pure functions, so the rules are tested without a database.
// No "server-only" here so the tests can import it.

export type Person = { id: number; rights: string; officeId: number | null; office?: { investorType?: string | null } | null };
export type Client = { id: number; name: string; approval: string; createdAt: Date; rmId: number | null };
export type Nda = { officeId: number; dealId: number; signedAt: Date };
export type Ask = { officeId: number; dealId: number; amountCr: string | number; status: string };
export type Target = { dealId: number; leg: string; intros: number | null; amountCr: number | null; note: string | null };

export const isPartnerOffice = (o?: { investorType?: string | null } | null) => o?.investorType === "broker";
/** The firm's principal: someone with commit rights. Sees every relationship manager and every client of the firm. */
export const isPartnerAdmin = (u: Person) => isPartnerOffice(u.office) && /commit/i.test(u.rights);

/** The clients this person may see: all of the firm's for a principal, only the ones they introduced for anyone else. */
export function visibleClients<T extends { rmId: number | null }>(u: Person, all: T[]) {
  return isPartnerAdmin(u) ? all : all.filter((c) => c.rmId === u.id);
}

export type Tally = { clients: number; approved: number; intros: number; indicatedCr: number; allottedCr: number };
const live = (a: Ask) => a.status !== "Withdrawn";
const round = (n: number) => Math.round(n * 100) / 100;

/** Counts for a set of clients, across every issue or for one. An introduction is a client that signed that company's NDA. */
export function tally(clients: Client[], ndas: Nda[], asks: Ask[], dealId?: number): Tally {
  const ids = new Set(clients.map((c) => c.id));
  const n = ndas.filter((x) => ids.has(x.officeId) && (dealId === undefined || x.dealId === dealId));
  const a = asks.filter((x) => ids.has(x.officeId) && live(x) && (dealId === undefined || x.dealId === dealId));
  return {
    clients: clients.length, approved: clients.filter((c) => c.approval === "approved").length,
    intros: new Set(n.map((x) => `${x.officeId}:${x.dealId}`)).size,
    indicatedCr: round(a.reduce((t, x) => t + Number(x.amountCr), 0)),
    allottedCr: round(a.filter((x) => x.status === "Allotted").reduce((t, x) => t + Number(x.amountCr), 0)),
  };
}

/** How far along a target is, as a share of 1 (the better of introductions and amount when both are set). */
export function progress(t: Pick<Target, "intros" | "amountCr"> | undefined, done: Pick<Tally, "intros" | "indicatedCr">) {
  if (!t) return null;
  const parts = [t.intros ? done.intros / t.intros : null, t.amountCr ? done.indicatedCr / t.amountCr : null].filter((x): x is number => x !== null);
  return parts.length ? Math.min(1, Math.max(...parts)) : null;
}

export const fmtCr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
