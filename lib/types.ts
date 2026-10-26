export type Cell = { k: string; v: string; s?: string };
export type Status = "done" | "in-progress" | "pending";

export type RoomContent = {
  lede: string;                       // one line under the company name
  why: string;                        // "Why it is on the desk"
  founders?: { name: string; role: string; url?: string }[]; // promoters and key management, with LinkedIn; shown to approved investors
  round: string;                      // "₹50 Cr · Secondary, pre-IPO"
  ticket: string;                     // "₹1 Cr"
  committed?: string;                 // "₹12 Cr of ₹35 Cr committed"
  fill?: { committedCr: number; anchor?: boolean; note?: string }; // how much of the round is spoken for, set by the desk; shown as a bar in the room
  snapshot: Cell[];
  highlight?: { title: string; a: { label: string; value: number }; b: { label: string; value: number }; center: string; centerNote: string; note: string };
  stake?: { sizeCr: number; postCr: number; note?: string };   // stake on offer = size / post-money
  risks: { t: string; d: string }[];
  feed: { date: string; text: string }[];
  fin?: { unit: string; cols: string[]; rows: { label: string; vals: string[] }[]; note?: string };
  pe?: { label: string; sub: string; value: number }[];
  multiples: Cell[];
  peers?: string;
  compare?: PeerCompare;
  compareDraft?: PeerCompare;         // an AI draft waiting for the desk; never shown to investors until saved as compare              // the full peer comparison; when absent, the desk's researched default for the slug (lib/peers) is shown
  terms: { k: string; v: string }[];
  path: { status: Status; title: string; note: string }[];
  checks: { status: Status; title: string; note?: string; date?: string }[];
  mine: string[];
  interest: { min: number; max: number; step: number; def: number; price?: number; sharesCr?: number; postCr?: number; colead?: boolean; note: string };
  scenario?: { pat: number; patLabel: string; months: number; monthsNote: string; price?: number; sharesCr?: number; postCr?: number; peDefault: number };
  alerts: string[];
  passReasons: string[];
};

/** The road to listing for a deal, kept by the desk and shown to offices that hold shares. Dates as YYYY-MM-DD. */
export type IpoProgress = {
  closed?: string;      // pre-IPO round closed / shares allotted
  drhp?: string;        // draft offer document filed (SEBI for main board, the exchange for SME)
  sebi?: string;        // SEBI observations (or exchange in-principle approval)
  rhp?: string;         // red herring prospectus / price band announced
  priceBand?: string;   // "₹420–440"
  listing?: string;     // listing date
  listPrice?: number;   // ₹ per share, listing-day close
  lastPrice?: number;   // ₹ per share, latest
  lastAt?: string;      // date of the latest price
  note?: string;        // one line from the desk
};

/** A listed-peer comparison for a deal room. companies[0] is the company in the room; every row carries one value per company, in that order. */
export type PeerCompare = {
  asOf: string;                       // "Market data as of 23 Oct 2026"
  basis: string;                      // what the figures are: periods, the round price, consolidation
  companies: { name: string; short: string; ticker?: string; subject?: boolean; mcapCr?: number | null; note?: string }[];
  metrics: { group: string; label: string; unit: string; better: "high" | "low" | "none"; vals: (number | null)[]; note?: string }[];
  scatter?: { x: string; y: string }; // labels of two metric rows for the positioning map
  dims: { name: string; scores: number[]; why: string }[];          // 1–5, relative within the set
  matrix: { aspect: string; cells: string[]; edge: "ahead" | "par" | "behind" | "mixed"; why: string }[];
  barriers: { name: string; level: number; note: string }[];        // 1 weak, 2 moderate, 3 strong
  stands: { ahead: string[]; behind: string[]; watch: string[]; valuation?: string[] }; // valuation: neutral facts on the multiple at the round
  sources: { title: string; url?: string }[];
};
