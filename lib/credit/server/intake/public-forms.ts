import "server-only";
import { withContext } from "@/lib/credit/db";
import { intakeSubmissions } from "@/lib/credit/schema";
import { NotFoundError } from "../actors";
import type { Applicant } from "./partner";

/** The one form an applicant's link opens (row-level security returns only that row). */
export async function submissionIdFor(who: Applicant): Promise<string> {
  const rows = await withContext({ role: "applicant", tokenHash: who.tokenHash }, (tx) => tx.select({ id: intakeSubmissions.id }).from(intakeSubmissions));
  if (rows.length !== 1) throw new NotFoundError();
  return rows[0].id;
}
