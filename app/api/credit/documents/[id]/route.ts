import { NextResponse } from "next/server";
import { currentActor } from "@/lib/credit/server/session";
import { NotFoundError } from "@/lib/credit/server/actors";
import { getDocumentForAdmin } from "@/lib/credit/server/admin/documents";
import { getDocumentForLender } from "@/lib/credit/server/lender/deals";
import { getObject } from "@/lib/credit/server/storage";

/**
 * The only route that serves diligence files. Permission is checked per request against the signed-in
 * user; lenders get a file only if its borrower is in one of their active deal shares. Anything else is 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  if (actor.kind === "partner" || actor.kind === "applicant_user") return new NextResponse("Not found", { status: 404 });
  try {
    const doc = actor.kind === "admin" ? await getDocumentForAdmin(actor, id) : await getDocumentForLender(actor, id);
    const data = await getObject(doc.storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
