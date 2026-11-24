import { NextResponse, type NextRequest } from "next/server";
import { requireDesk } from "@/lib/auth";
import { isSuper } from "@/lib/perm";
import { istDay } from "@/lib/stages";
import { buildDayReport, logReportTaken, reportFileName, reportPdf, reportText, type ReportKind } from "@/lib/day-report";

// Desk only. Builds a day report and hands it over as a PDF download (format=pdf) or as WhatsApp text (format=text).
// Either way the hand-over is logged: that is what the cut-off check reads. Analysts get only their own report.
export async function POST(req: NextRequest) {
  const me = await requireDesk();
  const f = await req.formData();
  const kind: ReportKind = f.get("kind") === "start" ? "start" : "end";
  const who = Number(f.get("who")) || me.id;
  if (who !== me.id && !isSuper(me)) return NextResponse.json({ error: "You can only take your own report." }, { status: 403 });
  const dayIn = String(f.get("day") || "");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayIn) && dayIn <= istDay() ? dayIn : istDay();
  const note = String(f.get("note") || "").slice(0, 1500);
  const r = await buildDayReport(kind, who, day, note);
  if (!r) return NextResponse.json({ error: "No such desk member." }, { status: 404 });
  const format = f.get("format") === "text" ? "text" : "pdf";
  await logReportTaken({ id: me.id, name: me.name }, r, format);
  if (format === "text") return NextResponse.json({ text: reportText(r) });
  const pdf = await reportPdf(r);
  return new NextResponse(Buffer.from(pdf), { headers: {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${reportFileName(r).replace(/[^\w .-]/g, "")}"`,
    "cache-control": "no-store",
  } });
}
