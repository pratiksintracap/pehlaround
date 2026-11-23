/*
 * Level 1 (platform screening) is baselined once, then refreshed quarterly or on material change.
 * A borrower can only have a raise opened while its Level 1 is approved and the refresh is not overdue.
 */
export const L1_REFRESH_MONTHS = 3;

export type L1Row = { status: string; refreshDueAt: Date | null } | null | undefined;

export function refreshDueFrom(approvedAt: Date): Date {
  const d = new Date(approvedAt);
  d.setMonth(d.getMonth() + L1_REFRESH_MONTHS);
  return d;
}

/** Status as it should be displayed, accounting for an overdue quarterly refresh. */
export function effectiveL1Status(row: L1Row, now = new Date()): string {
  if (!row) return "not_started";
  if (row.status === "approved" && row.refreshDueAt && row.refreshDueAt.getTime() < now.getTime()) return "refresh_due";
  return row.status;
}

export function l1IsCurrent(row: L1Row, now = new Date()): boolean {
  return effectiveL1Status(row, now) === "approved";
}

export const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  refresh_required: "Refresh required (material change)",
  refresh_due: "Quarterly refresh due",
  pending: "Pending",
  received: "Received",
  accepted: "Accepted",
  prospect: "Prospect",
  onboarding: "Onboarding",
  active: "Active",
  inactive: "Inactive",
  draft: "Draft",
  open: "Open",
  funded: "Funded",
  closed: "Closed",
  cancelled: "Cancelled",
  interested: "Interested",
  sanctioned: "Sanctioned",
  disbursed: "Disbursed",
  declined: "Declined",
  withdrawn: "Withdrawn",
  new: "New",
  contacted: "Contacted",
};
