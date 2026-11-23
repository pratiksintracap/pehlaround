import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/credit/server/actors";
import { applicantRoute } from "@/lib/credit/server/intake/http";
import { applicantFor } from "@/lib/credit/server/intake/public";
import { deleteFile, myFileForDownload } from "@/lib/credit/server/intake/partner";
import { readIntakeFile } from "@/lib/credit/server/intake/admin";

/** Download a file on a public form: only with that form's link. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const who = applicantFor(token);
  if (!who) return new NextResponse("Not found", { status: 404 });
  try {
    const f = await myFileForDownload(who, fileId);
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

export async function DELETE(req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  return applicantRoute(req, token, (who) => deleteFile(who, fileId));
}
