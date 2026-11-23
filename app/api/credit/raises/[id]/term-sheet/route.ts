import { NextResponse } from "next/server";
import { currentActor } from "@/lib/credit/server/session";
import { NotFoundError } from "@/lib/credit/server/actors";
import { draftRaiseFor, logTermSheet } from "@/lib/credit/server/draft-data";
import { buildTermSheet } from "@/lib/credit/server/drafts";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Term sheet / deal pack (Word). Admins: any raise. Lenders: only raises shared with them. Otherwise 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  try {
    const data = await draftRaiseFor(actor, id);
    const file = await buildTermSheet(data);
    await logTermSheet(actor, id);
    const name = `term-sheet-${data.borrower.name.replace(/[^a-z0-9]+/gi, "-")}-${data.cycle}-${data.cycleStart.slice(0, 7)}-v${data.termsVersion}.docx`;
    return new NextResponse(new Uint8Array(file), {
      headers: { "Content-Type": DOCX, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
