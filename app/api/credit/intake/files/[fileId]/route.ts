import { NextResponse } from "next/server";
import { currentActor } from "@/lib/credit/server/session";
import { NotFoundError } from "@/lib/credit/server/actors";
import { formRoute } from "@/lib/credit/server/intake/http";
import { deleteFile, myFileForDownload } from "@/lib/credit/server/intake/partner";
import { fileForAdmin, readIntakeFile } from "@/lib/credit/server/intake/admin";

/** Download: the platform team, or the partner whose submission it is. Anything else is 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const actor = await currentActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  const { fileId } = await params;
  try {
    const f =
      actor.kind === "admin" ? await fileForAdmin(actor, fileId) : actor.kind === "partner" ? await myFileForDownload(actor, fileId) : null;
    if (!f) return new NextResponse("Not found", { status: 404 });
    const data = await readIntakeFile(f.parts);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": f.contentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return formRoute(req, (actor) => deleteFile(actor, fileId));
}
