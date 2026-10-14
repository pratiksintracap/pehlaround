export type Cell = { k: string; v: string; s?: string };
export type Status = "done" | "in-progress" | "pending";

export type RoomContent = {
  lede: string;                       // one line under the company name
  why: string;                        // "Why it is on the desk"
  round: string;                      // "₹50 Cr · Secondary, pre-IPO"
  ticket: string;                     // "₹1 Cr"
  committed?: string;                 // "₹12 Cr of ₹35 Cr committed"
  snapshot: Cell[];
  highlight?: { title: string; a: { label: string; value: number }; b: { label: string; value: number }; center: string; centerNote: string; note: string };
  stake?: { sizeCr: number; postCr: number; note?: string };   // stake on offer = size / post-money
  risks: { t: string; d: string }[];
  feed: { date: string; text: string }[];
  fin?: { unit: string; cols: string[]; rows: { label: string; vals: string[] }[]; note?: string };
  pe?: { label: string; sub: string; value: number }[];
  multiples: Cell[];
  peers?: string;
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
