"use server";

import { revalidatePath } from "next/cache";
import { requireLender } from "@/lib/credit/server/session";
import { run, str, type ActionState } from "@/lib/credit/server/action";
import { expressInterest, postMyMessage, setMyLevel2, withdrawInterest } from "@/lib/credit/server/lender/deals";

/*
 * Lender server actions. The lender's identity and organisation come only from the session; the form
 * supplies just the raise ID, which the service checks against the lender's own active shares.
 */

export async function setLevel2Action(_: ActionState, fd: FormData): Promise<ActionState> {
  const lender = await requireLender();
  const id = str(fd, "raiseId");
  const res = await run(() => setMyLevel2(lender, id, str(fd, "status"), str(fd, "notes")), "Level 2 status saved");
  revalidatePath(`/credit/lender/deals/${id}`);
  return res;
}

export async function expressInterestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const lender = await requireLender();
  const id = str(fd, "raiseId");
  const res = await run(() => expressInterest(lender, id, str(fd, "amount")), "Interest sent to the platform team");
  revalidatePath(`/credit/lender/deals/${id}`);
  revalidatePath("/credit/lender");
  return res;
}

export async function withdrawInterestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const lender = await requireLender();
  const id = str(fd, "raiseId");
  const res = await run(() => withdrawInterest(lender, id), "Interest withdrawn");
  revalidatePath(`/credit/lender/deals/${id}`);
  revalidatePath("/credit/lender");
  return res;
}

export async function postMessageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const lender = await requireLender();
  const id = str(fd, "raiseId");
  const res = await run(() => postMyMessage(lender, id, str(fd, "body")), "Sent to the platform team");
  revalidatePath(`/credit/lender/deals/${id}`);
  return res;
}
