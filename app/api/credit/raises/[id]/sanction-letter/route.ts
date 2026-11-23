import { NextResponse } from "next/server";
import { currentActor } from "@/lib/credit/server/session";
import { NotFoundError, ValidationError } from "@/lib/credit/server/actors";
import { draftRaiseFor, sanctionFor } from "@/lib/credit/server/draft-data";
import { buildSanctionLetter } from "@/lib/credit/server/drafts";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Sanction letter draft (Word) for one sanctioned allocation. Lenders get only their own (any ?lender= is ignored);
 * admins pick the lender with ?lender=<id>. Anything else is 404.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  try {
    const data = await draftRaiseFor(actor, id);
    const lender = await sanctionFor(actor, id, new URL(req.url).searchParams.get("lender"));
    const file = await buildSanctionLetter(data, lender);
    const name = `sanction-letter-draft-${lender.name.replace(/[^a-z0-9]+/gi, "-")}-${data.cycle}-${data.cycleStart.slice(0, 7)}.docx`;
    return new NextResponse(new Uint8Array(file), {
      headers: { "Content-Type": DOCX, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ValidationError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
