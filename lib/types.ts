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
