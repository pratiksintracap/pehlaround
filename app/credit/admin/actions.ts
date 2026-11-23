"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/credit/server/session";
import { run, str, type ActionState } from "@/lib/credit/server/action";
import { ValidationError } from "@/lib/credit/server/actors";
import * as L from "@/lib/credit/server/admin/lenders";
import * as B from "@/lib/credit/server/admin/borrowers";
import * as R from "@/lib/credit/server/admin/raises";
import * as Ref from "@/lib/credit/server/admin/reference";
import * as O from "@/lib/credit/server/admin/overview";
import * as M from "@/lib/credit/server/admin/messages";
import * as A from "@/lib/credit/server/admin/approvals";
import * as F from "@/lib/credit/server/admin/financials";
import * as P from "@/lib/credit/server/admin/prospects";
import * as Intake from "@/lib/credit/server/intake/admin";
import * as DD from "@/lib/credit/server/admin/direct-deals";

/*
 * Every admin server action starts with requireAdmin(): server actions are public HTTP endpoints, so the
 * page they live on being admin-only is not enough on its own.
 */

// ---------- lenders ----------

function lenderInput(fd: FormData): L.LenderInput {
  const segmentTargets: Record<string, string> = {};
  for (const id of fd.getAll("segment")) segmentTargets[String(id)] = str(fd, `target_${id}`);
  return {
    name: str(fd, "name"),
    minTicket: str(fd, "minTicket"),
    maxTicket: str(fd, "maxTicket"),
    minRate: str(fd, "minRate"),
    maxRate: str(fd, "maxRate"),
    thesisNotes: str(fd, "thesisNotes"),
    active: fd.get("active") === "on",
    segmentTargets,
    securityLevelIds: fd.getAll("securityLevel").map(String),
    instrumentIds: fd.getAll("instrument").map(String),
  };
}

export async function createLenderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let id = "";
  const res = await run(async () => {
    id = await L.saveLender(admin, null, lenderInput(fd));
  });
  if (res?.error) return res;
  redirect(`/credit/admin/lenders/${id}`);
}

export async function updateLenderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => L.saveLender(admin, id, lenderInput(fd)), "Lender profile saved");
  revalidatePath(`/credit/admin/lenders/${id}`);
  return res;
}

export async function addUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(
    () => L.addUser(admin, { email: str(fd, "email"), name: str(fd, "name"), role: str(fd, "role"), lenderId: str(fd, "lenderId") || undefined }),
    "User added. They can sign in with their email.",
  );
  revalidatePath("/credit/admin", "layout");
  return res;
}

export async function setUserDisabledAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const disable = str(fd, "disable") === "1";
  const res = await run(() => L.setUserDisabled(admin, str(fd, "userId"), disable), disable ? "User disabled" : "User enabled");
  revalidatePath("/credit/admin", "layout");
  return res;
}

export async function resetTotpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => L.resetUserTotp(admin, str(fd, "userId")), "Authenticator reset. They'll set it up again at next sign-in.");
  revalidatePath("/credit/admin", "layout");
  return res;
}

// ---------- borrowers & diligence ----------

function borrowerInput(fd: FormData): B.BorrowerInput {
  return {
    name: str(fd, "name"),
    cin: str(fd, "cin"),
    rbiRegistration: str(fd, "rbiRegistration"),
    city: str(fd, "city"),
    state: str(fd, "state"),
    status: str(fd, "status") || "prospect",
    drawdownCycle: str(fd, "drawdownCycle"),
    notes: str(fd, "notes"),
    segmentIds: fd.getAll("segment").map(String),
  };
}

export async function createBorrowerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let id = "";
  const res = await run(async () => {
    id = await B.saveBorrower(admin, null, borrowerInput(fd));
  });
  if (res?.error) return res;
  redirect(`/credit/admin/borrowers/${id}`);
}

export async function updateBorrowerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => B.saveBorrower(admin, id, borrowerInput(fd)), "Borrower saved");
  revalidatePath(`/credit/admin/borrowers/${id}`);
  return res;
}

export async function addItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "borrowerId");
  const res = await run(() => B.addDiligenceItem(admin, id, str(fd, "title"), str(fd, "description")), "Item added");
  revalidatePath(`/credit/admin/borrowers/${id}`);
  return res;
}

export async function setItemStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => B.setDiligenceItemStatus(admin, str(fd, "itemId"), str(fd, "status"), str(fd, "note")), "Updated");
  revalidatePath(`/credit/admin/borrowers/${str(fd, "borrowerId")}`);
  return res;
}

export async function uploadDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const borrowerId = str(fd, "borrowerId");
  const file = fd.get("file");
  const res = await run(async () => {
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file to upload");
    await B.uploadDocument(
      admin,
      borrowerId,
      str(fd, "itemId") || null,
      { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) },
      fd.get("replaces") === "on",
    );
  }, "Document uploaded");
  revalidatePath(`/credit/admin/borrowers/${borrowerId}`);
  return res;
}

export async function setL1Action(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "borrowerId");
  const res = await run(() => B.setL1Status(admin, id, str(fd, "status"), str(fd, "notes")), "Level 1 status updated");
  revalidatePath(`/credit/admin/borrowers/${id}`);
  return res;
}

export async function setL2AsAdminAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "borrowerId");
  const res = await run(() => B.setLenderReviewAsAdmin(admin, str(fd, "lenderId"), id, str(fd, "status"), str(fd, "notes")), "Level 2 status recorded");
  revalidatePath(`/credit/admin/borrowers/${id}`);
  return res;
}

// ---------- raises, matching, sell-down ----------

function raiseInput(fd: FormData): R.RaiseInput {
  return {
    borrowerId: str(fd, "borrowerId"),
    cycleStart: str(fd, "cycleStart"),
    amount: str(fd, "amount"),
    lenderRate: str(fd, "lenderRate"),
    borrowerRate: str(fd, "borrowerRate"),
    expectedRateMin: str(fd, "expectedRateMin"),
    expectedRateMax: str(fd, "expectedRateMax"),
    instrumentId: str(fd, "instrumentId"),
    segmentId: str(fd, "segmentId"),
    purpose: str(fd, "purpose"),
    securityLevelId: str(fd, "securityLevelId"),
    securityDescription: str(fd, "securityDescription"),
    terms: str(fd, "terms"),
  };
}

export async function createRaiseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let id = "";
  const res = await run(async () => {
    id = await R.saveRaise(admin, null, raiseInput(fd));
  });
  if (res?.error) return res;
  redirect(`/credit/admin/raises/${id}`);
}

export async function updateRaiseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => R.saveRaise(admin, id, raiseInput(fd)), "Raise saved");
  revalidatePath(`/credit/admin/raises/${id}`);
  return res;
}

export async function repeatRaiseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let id = "";
  const res = await run(async () => {
    id = await R.repeatRaise(admin, str(fd, "id"));
  });
  if (res?.error) return res;
  redirect(`/credit/admin/raises/${id}`);
}

export async function setRaiseStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => R.setRaiseStatus(admin, id, str(fd, "status")), "Status updated");
  revalidatePath(`/credit/admin/raises/${id}`);
  return res;
}

export async function requestShareAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(
    () => A.requestShare(admin, id, fd.getAll("lenderId").map(String)),
    "Share requested. Another admin needs to approve it before lenders see the raise.",
  );
  revalidatePath(`/credit/admin/raises/${id}`);
  revalidatePath("/credit/admin");
  return res;
}

export async function requestSanctionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(
    () => A.requestSanction(admin, id, str(fd, "lenderId"), str(fd, "amount")),
    "Sanction requested. Another admin needs to approve it.",
  );
  revalidatePath(`/credit/admin/raises/${id}`);
  revalidatePath("/credit/admin");
  return res;
}

export async function approveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => A.approve(admin, str(fd, "approvalId"), str(fd, "note")), "Approved and carried out");
  revalidatePath("/credit/admin", "layout");
  return res;
}

export async function rejectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => A.reject(admin, str(fd, "approvalId"), str(fd, "note")), "Rejected");
  revalidatePath("/credit/admin", "layout");
  return res;
}

export async function cancelApprovalAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => A.cancel(admin, str(fd, "approvalId")), "Request cancelled");
  revalidatePath("/credit/admin", "layout");
  return res;
}

export async function recordMovementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const kind = str(fd, "kind");
  const res = await run(
    () => R.recordMovement(admin, id, str(fd, "lenderId"), kind, str(fd, "amount"), str(fd, "valueDate"), str(fd, "note")),
    kind === "repayment" ? "Repayment recorded" : "Disbursement recorded",
  );
  revalidatePath(`/credit/admin/raises/${id}`);
  return res;
}

export async function saveFinancialsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "borrowerId");
  const res = await run(
    () => F.saveFinancials(admin, id, { periodEnd: str(fd, "periodEnd"), aum: str(fd, "aum"), gnpaPct: str(fd, "gnpaPct"), leverage: str(fd, "leverage") }),
    "Quarterly figures saved",
  );
  revalidatePath(`/credit/admin/borrowers/${id}`);
  return res;
}

export async function addInstrumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => Ref.addInstrument(admin, str(fd, "name")), "Instrument added");
  revalidatePath("/credit/admin/settings");
  return res;
}

export async function eraseAccessRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => O.eraseAccessRequest(admin, str(fd, "id")), "Request erased");
  revalidatePath("/credit/admin/access-requests");
  return res;
}

export async function revokeShareAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => R.revokeShare(admin, id, str(fd, "lenderId")), "Access revoked");
  revalidatePath(`/credit/admin/raises/${id}`);
  return res;
}

export async function setAllocationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => R.setAllocation(admin, id, str(fd, "lenderId"), str(fd, "amount"), str(fd, "status")), "Allocation saved");
  revalidatePath(`/credit/admin/raises/${id}`);
  return res;
}

// ---------- settings & intake ----------

export async function addSegmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => Ref.addSegment(admin, str(fd, "name")), "Segment added");
  revalidatePath("/credit/admin/settings");
  return res;
}

export async function addSecurityLevelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => Ref.addSecurityLevel(admin, str(fd, "name"), str(fd, "rank")), "Security level added");
  revalidatePath("/credit/admin/settings");
  return res;
}

export async function addChecklistItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => Ref.addChecklistItem(admin, str(fd, "title"), str(fd, "description")), "Checklist item added");
  revalidatePath("/credit/admin/settings");
  return res;
}

export async function removeChecklistItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => Ref.removeChecklistItem(admin, str(fd, "id")), "Removed");
  revalidatePath("/credit/admin/settings");
  return res;
}

export async function setAccessRequestStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => O.setAccessRequestStatus(admin, str(fd, "id"), str(fd, "status")), "Updated");
  revalidatePath("/credit/admin/access-requests");
  return res;
}

// ---------- Q&A ----------

export async function postPlatformMessageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => M.postPlatformMessage(admin, id, str(fd, "lenderId"), str(fd, "body")), "Reply sent");
  revalidatePath(`/credit/admin/raises/${id}`);
  return res;
}

export async function requestDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(
    () => M.requestDocumentForLender(admin, id, str(fd, "lenderId"), str(fd, "title"), str(fd, "description")),
    "Added to the borrower's Level 1 checklist and noted in the thread",
  );
  revalidatePath(`/credit/admin/raises/${id}`);
  return res;
}

// ---------- prospects & outreach ----------

const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

export async function importProspectsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the CSV file to import", at: Date.now() };
  if (file.size > MAX_IMPORT_BYTES) return { error: "That file is over 4 MB. Split it into parts and import each one.", at: Date.now() };
  if (!/\.csv$/i.test(file.name)) return { error: "Import a .csv file", at: Date.now() };
  const text = await file.text();
  let summary = "";
  const res = await run(async () => {
    const r = await P.importRegistry(admin, text);
    summary = `Imported ${r.rows} NBFCs: ${r.added} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} rows skipped (no name)` : ""}.`;
  });
  revalidatePath("/credit/admin/prospects", "layout");
  return res?.error ? res : { ok: summary, at: Date.now() };
}

export async function updateProspectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(
    () =>
      P.updateProspect(admin, id, {
        status: str(fd, "status"),
        contactName: str(fd, "contactName"),
        contactRole: str(fd, "contactRole"),
        contactEmail: str(fd, "contactEmail"),
        contactPhone: str(fd, "contactPhone"),
        notes: str(fd, "notes"),
        nextFollowUp: str(fd, "nextFollowUp"),
        loanBookCr: str(fd, "loanBookCr"),
        aumCr: str(fd, "aumCr"),
        sizeAsOf: str(fd, "sizeAsOf"),
        sizeSource: str(fd, "sizeSource"),
      }),
    "Saved",
  );
  revalidatePath(`/credit/admin/prospects/${id}`);
  return res;
}

export async function sendOutreachAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(() => P.sendOutreach(admin, id, { to: str(fd, "to"), subject: str(fd, "subject"), body: str(fd, "body") }), "Sent.");
  revalidatePath(`/credit/admin/prospects/${id}`);
  return res;
}

export async function convertProspectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let borrowerId = "";
  const res = await run(async () => {
    borrowerId = await P.convertToBorrower(admin, str(fd, "id"));
  });
  if (res?.error) return res;
  redirect(`/credit/admin/borrowers/${borrowerId}`);
}

export async function saveOutreachTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => P.saveTemplate(admin, { subject: str(fd, "subject"), body: str(fd, "body") }), "Template saved. It's used for every new outreach email.");
  revalidatePath("/credit/admin/prospects", "layout");
  return res;
}

export async function saveBandAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => P.saveBand(admin, { minCr: str(fd, "minCr"), maxCr: str(fd, "maxCr") }), "Target band saved");
  revalidatePath("/credit/admin/prospects", "layout");
  return res;
}

// ---------- partners and borrower submissions ----------


export async function createPartnerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => Intake.createPartner(admin, { name: str(fd, "name"), city: str(fd, "city"), notes: str(fd, "notes") }), "Partner added");
  revalidatePath("/credit/admin/partners");
  return res;
}

export async function addPartnerUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(
    () => Intake.addPartnerUser(admin, str(fd, "partnerId"), { email: str(fd, "email"), name: str(fd, "name") }),
    "Added. They can sign in with their email now.",
  );
  revalidatePath("/credit/admin/partners");
  return res;
}

export async function setSubmissionStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const status = str(fd, "status");
  const res = await run(
    () => Intake.setSubmissionStatus(admin, str(fd, "id"), status, str(fd, "note")),
    status === "needs_info" ? "Sent back to the partner, with your note" : "Updated",
  );
  revalidatePath(`/credit/admin/submissions/${str(fd, "id")}`);
  return res;
}

export async function acceptSubmissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let borrowerId = "";
  const res = await run(async () => {
    borrowerId = await Intake.acceptAsBorrower(admin, str(fd, "id"));
  }, "Borrower created");
  if (borrowerId) redirect(`/credit/admin/borrowers/${borrowerId}`);
  return res;
}

// ---------- direct deals ----------


const DEAL_FIELDS = [
  "companyName", "cin", "sector", "city", "state", "amountCr", "facility", "purpose", "tenorMonths", "security", "rateExpectation",
  "stage", "source", "contactName", "contactRole", "contactEmail", "contactPhone", "nextStep", "nextStepOn", "notes",
];
const dealInput = (fd: FormData) => Object.fromEntries(DEAL_FIELDS.map((k) => [k, str(fd, k)]));

export async function createDirectDealAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let id = "";
  const res = await run(async () => {
    id = await DD.createDirectDeal(admin, dealInput(fd));
  }, "Deal added");
  if (id) redirect(`/credit/admin/deals/${id}`);
  return res;
}

export async function updateDirectDealAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => DD.updateDirectDeal(admin, str(fd, "id"), dealInput(fd)), "Saved");
  revalidatePath("/credit/admin/deals", "layout");
  return res;
}

export async function addDealLenderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => DD.addDealLender(admin, str(fd, "dealId"), { lenderId: str(fd, "lenderId"), lenderName: str(fd, "lenderName") }), "Lender added");
  revalidatePath(`/credit/admin/deals/${str(fd, "dealId")}`);
  return res;
}

export async function updateDealLenderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res =
    str(fd, "remove") === "1"
      ? await run(() => DD.removeDealLender(admin, str(fd, "rowId")), "Removed")
      : await run(
          () => DD.updateDealLender(admin, str(fd, "rowId"), { status: str(fd, "status"), amountCr: str(fd, "amountCr"), rate: str(fd, "rate"), note: str(fd, "note") }),
          "Saved",
        );
  revalidatePath(`/credit/admin/deals/${str(fd, "dealId")}`);
  return res;
}

export async function saveDirectMinAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await run(() => DD.saveDirectMin(admin, str(fd, "minCr")), "Minimum size saved");
  revalidatePath("/credit/admin/deals", "layout");
  return res;
}

export async function importResearchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const file = fd.get("file");
  let text = str(fd, "csv");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMPORT_BYTES) return { error: "That file is over 4 MB. Split it into parts.", at: Date.now() };
    text = await file.text();
  }
  if (!text.trim()) return { error: "Choose a CSV file or paste the CSV", at: Date.now() };
  let summary = "";
  const res = await run(async () => {
    const r = await P.importResearch(admin, text);
    const miss = r.unmatched.slice(0, 15).map((u) => `${u.name} (${u.reason})`).join("; ");
    summary = `${r.matched} of ${r.rows} NBFCs updated.${r.unmatched.length ? ` Not matched (${r.unmatched.length}): ${miss}${r.unmatched.length > 15 ? "; …" : ""}` : ""}`;
  });
  revalidatePath("/credit/admin/prospects", "layout");
  return res?.ok ? { ok: summary, at: Date.now() } : res;
}

export async function updateProspectResearchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const keys = ["segment", "website", "ratingAgency", "rating", "ratingOutlook", "ratingDate", "ratingUrl", "gnpaPct", "crarPct", "bankFacilitiesCr", "lenders", "chargesTotalCr", "directors", "lastFilingOn", "researchNotes"];
  const res = await run(() => P.updateProspectResearch(admin, str(fd, "id"), Object.fromEntries(keys.map((k) => [k, str(fd, k)]))), "Research saved");
  revalidatePath(`/credit/admin/prospects/${str(fd, "id")}`);
  return res;
}

export async function createSubmissionForPartnerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let id = "";
  const res = await run(async () => {
    let partnerId = str(fd, "partnerId");
    if (partnerId === "new") partnerId = await Intake.createPartner(admin, { name: str(fd, "newPartner"), city: "", notes: "" });
    id = await Intake.createSubmissionForPartner(admin, { partnerId, companyName: str(fd, "companyName"), cin: str(fd, "cin") });
  });
  if (!id) return res;
  revalidatePath("/credit/admin/submissions");
  redirect(`/credit/admin/submissions/${id}/edit`);
}
