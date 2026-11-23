"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/credit/server/session";
import { run, str, type ActionState } from "@/lib/credit/server/action";
import * as I from "@/lib/credit/server/intake/partner";

/* Every partner action starts with requirePartner(): server actions are public endpoints. */

export async function createSubmissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const partner = await requirePartner();
  let id = "";
  const res = await run(async () => {
    id = await I.createSubmission(partner, str(fd, "companyName"));
  }, "Added");
  if (id) redirect(`/credit/partner/submissions/${id}`);
  return res;
}

export async function deleteDraftAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const partner = await requirePartner();
  const res = await run(() => I.deleteDraft(partner, str(fd, "id")), "Deleted");
  if (res?.ok) {
    revalidatePath("/credit/partner");
    redirect("/credit/partner");
  }
  return res;
}
