import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { kycFiles, offices } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { can, isDesk } from "@/lib/perm";
import { canSeeOffice } from "@/lib/desk";
import { getSettings } from "@/lib/settings";
import { KYC_KINDS, isKycKind } from "@/lib/transfer";

/**
 * One transfer document. The office's own people may open it; on the desk, whoever may see the office's contact
 * details (the super admin, and analysts if Settings allows). Every desk open is logged against the office.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("Not found", { status: 404 });
  const db = await getDb();
  const [f] = await db.select().from(kycFiles).where(eq(kycFiles.id, id));
  if (!f) return new NextResponse("Not found", { status: 404 });
  const own = !!user.officeId && user.officeId === f.officeId;
  let desk = false;
  if (!own && isDesk(user)) {
    const [o] = await db.select({ origin: offices.origin, addedById: offices.addedById }).from(offices).where(eq(offices.id, f.officeId));
    desk = !!o && canSeeOffice(user, o) && can(user, "contacts.view", { analystContacts: (await getSettings()).analystContacts });
  }
  if (!own && !desk) return new NextResponse("Not found", { status: 404 });
  if (desk) await log(user, `Opened ${isKycKind(f.kind) ? KYC_KINDS[f.kind].label : f.kind} of office #${f.officeId}`, null, { entity: "office", entityId: f.officeId, officeId: f.officeId });
  const safe = f.name.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(Buffer.from(f.data, "base64")), {
    headers: { "content-type": f.mime, "content-disposition": `inline; filename="${safe}"`, "cache-control": "private, no-store", "x-robots-tag": "noindex", "x-content-type-options": "nosniff" },
  });
}
