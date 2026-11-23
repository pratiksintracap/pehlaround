export const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  diligence: "Diligence",
  with_lenders: "With lenders",
  term_sheet: "Term sheet",
  sanctioned: "Sanctioned",
  disbursed: "Disbursed",
  on_hold: "On hold",
  closed_lost: "Closed, not done",
};
export const STAGE_TONE: Record<string, string> = {
  lead: "new",
  diligence: "in_review",
  with_lenders: "open",
  term_sheet: "in_review",
  sanctioned: "approved",
  disbursed: "disbursed",
  on_hold: "idle",
  closed_lost: "declined",
};
export const LENDER_STATUS_LABEL: Record<string, string> = {
  to_approach: "To approach",
  approached: "Approached",
  interested: "Interested",
  term_sheet: "Term sheet",
  sanctioned: "Sanctioned",
  declined: "Declined",
};
export const cr = (v: string | number | null | undefined) =>
  v == null || v === "" ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
