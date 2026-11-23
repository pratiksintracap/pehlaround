import { NextResponse } from "next/server";
import { currentActor } from "@/lib/credit/server/session";
import { NotFoundError } from "@/lib/credit/server/actors";
import { adminRoute } from "@/lib/credit/server/intake/http";
import { dealFileForDownload, deleteDealFile } from "@/lib/credit/server/admin/direct-deals";
import { readIntakeFile } from "@/lib/credit/server/intake/admin";

/** Direct-deal files: platform team only. */
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const actor = await currentActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  if (actor.kind !== "admin") return new NextResponse("Not found", { status: 404 });
  const { fileId } = await params;
  try {
    const f = await dealFileForDownload(actor, fileId);
    const data = await readIntakeFile(f.parts);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": f.contentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return adminRoute(req, (a) => deleteDealFile(a, fileId));
}
