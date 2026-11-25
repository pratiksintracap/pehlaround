import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { istDay } from "@/lib/stages";
import { buildOnePager, onePagerPdf } from "@/lib/onepager";

// Super admin: the one-pager for a day as a PDF.
export async function GET(req: NextRequest) {
  await requireAdmin();
  const q = req.nextUrl.searchParams.get("day") || "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= istDay() ? q : istDay();
  const pdf = await onePagerPdf(await buildOnePager(day));
  return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="Desk one-pager ${day}.pdf"`, "cache-control": "no-store" } });
}
