import { type NextRequest } from "next/server";
import { runDue } from "@/lib/onboarding";

// Vercel calls this daily at 03:30 UTC (09:00 IST); see vercel.json. Protected by CRON_SECRET.
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorised", { status: 401 });
  const r = await runDue();
  return Response.json(r);
}
