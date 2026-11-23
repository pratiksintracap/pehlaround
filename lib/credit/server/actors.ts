import type { DbContext } from "@/lib/credit/db";

/** The signed-in principal, resolved server-side from the session. Services take one of these, never raw IDs from the client. */
export type AdminActor = { kind: "admin"; userId: string; name: string; email: string };
export type LenderActor = {
  kind: "lender";
  userId: string;
  name: string;
  email: string;
  lenderId: string;
  role: "lender_admin" | "lender_viewer";
};
/** An aggregator who introduces borrower NBFCs and fills their information form. */
export type PartnerActor = { kind: "partner"; userId: string; name: string; email: string; partnerId: string };
/** Someone who started a borrower form on the website; their account was made then. Sees only their own forms. */
export type ApplicantUserActor = { kind: "applicant_user"; userId: string; name: string; email: string };
export type Actor = AdminActor | LenderActor | PartnerActor | ApplicantUserActor;

export function dbCtx(a: Actor): DbContext {
  if (a.kind === "admin") return { role: "admin", userId: a.userId };
  if (a.kind === "partner") return { role: "partner", userId: a.userId, partnerId: a.partnerId };
  if (a.kind === "applicant_user") return { role: "applicant_account", userId: a.userId, email: a.email };
  return { role: "lender", userId: a.userId, lenderId: a.lenderId };
}

/** Thrown when a resource does not exist *or* the actor may not see it. Rendered as 404 so existence never leaks. */
export class NotFoundError extends Error {
  constructor(what = "Not found") {
    super(what);
    this.name = "NotFoundError";
  }
}

/** Thrown when the actor is known to see the resource but lacks permission to act (e.g. lender viewer writing). */
export class ForbiddenError extends Error {
  constructor(what = "Forbidden") {
    super(what);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
