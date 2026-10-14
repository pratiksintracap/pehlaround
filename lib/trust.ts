import "server-only";
import { cookies } from "next/headers";
import { signTemp, verifyTemp } from "@/lib/auth";

// A device where the signer confirmed an emailed code: further NDAs from it skip the code for 30 days.
const TD = "omd_td", DAYS = 30;

export async function trustedDevice(userId: number) {
  const p = await verifyTemp<{ uid: number; k: string }>((await cookies()).get(TD)?.value);
  return !!p && p.k === "td" && Number(p.uid) === userId;
}

export async function trustDevice(userId: number) {
  const t = await signTemp({ uid: userId, k: "td" }, 60 * 24 * DAYS);
  (await cookies()).set(TD, t, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAYS * 86400 });
}
