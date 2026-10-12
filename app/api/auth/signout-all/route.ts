import { NextResponse, type NextRequest } from "next/server";
import { createSession, getUser, log, signOutEverywhere } from "@/lib/auth";

/** Ends the user's sign-ins on every other device and keeps this one. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  await signOutEverywhere(user.id);
  await createSession(user.id);
  await log(user, "Signed out of every other device");
  return NextResponse.redirect(new URL("/dashboard?msg=" + encodeURIComponent("Signed out of every other device.") + "#Team", req.url), 303);
}
