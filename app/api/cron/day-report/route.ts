import { type NextRequest } from "next/server";
import { runDayReportEmails } from "@/lib/day-report";

// Vercel calls this daily at 14:00 UTC (19:30 IST); see vercel.json. Protected by CRON_SECRET.
// Emails each desk member's end-of-day report to the report recipients, saying whether the member sent it by the cut-off.
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorised", { status: 401 });
  const end = await runDayReportEmails("end", new Date(), req.nextUrl.searchParams.get("force") === "1").catch((e) => ({ error: String(e) }));
  return Response.json({ end });
}
