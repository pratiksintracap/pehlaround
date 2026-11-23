"use server";

import { redirect } from "next/navigation";
import { requestIp } from "@/lib/credit/server/session";
import { startApplication } from "@/lib/credit/server/intake/public";

export type StartState = { error?: string; at?: number } | null;

export async function startApplicationAction(_: StartState, fd: FormData): Promise<StartState> {
  const input = Object.fromEntries(["role", "name", "email", "phone", "agentFirm", "companyName", "cin", "website", "consent", "noticeVersion"].map((k) => [k, String(fd.get(k) ?? "")]));
  let res;
  try {
    res = await startApplication(input, await requestIp());
  } catch (e) {
    console.error("[apply] start failed", e);
    return { error: "We couldn't start the form just now. Please try again in a few minutes.", at: Date.now() };
  }
  if (!res.ok) return { error: res.error, at: Date.now() };
  redirect(`/credit/apply/${res.token}?new=1`);
}
