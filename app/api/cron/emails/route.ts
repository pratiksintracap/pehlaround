import { type NextRequest } from "next/server";
import { runDue } from "@/lib/onboarding";
import { runDigest } from "@/lib/digest";
import { refreshEmailStatus } from "@/lib/email-status";
import { runInviteFollowUps } from "@/lib/invite-followup";

// Vercel calls this daily at 03:30 UTC (09:00 IST); see vercel.json. Protected by CRON_SECRET.
// Sends the onboarding emails that are due, the Monday articles digest, the one invitation reminder (3 days on), and refreshes delivery status for recent emails.
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorised", { status: 401 });
  const onboarding = await runDue();
  const digest = await runDigest({ force: req.nextUrl.searchParams.get("digest") === "force" }).catch((e) => ({ error: String(e) }));
  const followups = await runInviteFollowUps().catch((e) => ({ error: String(e) }));
  const status = await refreshEmailStatus().catch((e) => ({ error: String(e) }));
  return Response.json({ onboarding, digest, followups, status });
}
