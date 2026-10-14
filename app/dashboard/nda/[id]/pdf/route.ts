import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { ndaRecord, ndaFilename } from "@/lib/nda-mail";
import { ndaPdf } from "@/lib/nda-pdf";
import { isDesk } from "@/lib/perm";

/** The signed NDA as a PDF, for the office that signed it (and the desk). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/dashboard", req.url));
  const r = await ndaRecord(Number((await params).id));
  if (!r || (r.officeId !== user.officeId && !isDesk(user))) return new NextResponse("Not found", { status: 404 });
  const pdf = await ndaPdf(r);
  return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${ndaFilename(r)}"`, "cache-control": "private, no-store" } });
}
