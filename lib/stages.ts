// The desk's own deal pipeline. Desk only: never shown to investors, and moving a deal between stages
// does not publish, open or close anything on the site (those stay with the deal's visibility switches).
export const DEAL_STAGES = [
  { id: "sourced", label: "Sourced", hint: "First look; not yet in diligence" },
  { id: "diligence", label: "Diligence", hint: "Visits, documents, numbers" },
  { id: "live", label: "Live", hint: "On the desk for approved investors" },
  { id: "interest", label: "Interest collection", hint: "Collecting non-binding indications" },
  { id: "docs", label: "Term sheet / KYC", hint: "Term sheet, SHA and KYC" },
  { id: "escrow", label: "Escrow / allotment", hint: "Money in escrow, allotment or transfer" },
  { id: "closed", label: "Closed", hint: "Allotted, transferred or dropped" },
  { id: "archived", label: "Archived", hint: "Dropped, listed elsewhere or not a deal; kept for the record, off the working lists" },
] as const;
export type DealStage = (typeof DEAL_STAGES)[number]["id"];
/** The stages the desk works in: everything but the archive. */
export const ACTIVE_STAGES = DEAL_STAGES.filter((s) => s.id !== "archived");
export const STAGE_IDS = DEAL_STAGES.map((s) => s.id) as DealStage[];
export const stageLabel = (id: string | null | undefined) => DEAL_STAGES.find((s) => s.id === id)?.label ?? "Sourced";
export const asStage = (v: string): DealStage | null => (STAGE_IDS as string[]).includes(v) ? (v as DealStage) : null;

/** Deal types the desk sees in listed companies. */
export const LISTED_TYPES = ["Block deal", "Bulk deal", "Preferential allotment", "QIP", "Promoter stake sale", "Rights issue", "OFS", "Warrants", "Other"];

/** Today's date in India as YYYY-MM-DD (task due dates and reminders run on IST days). */
export const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
