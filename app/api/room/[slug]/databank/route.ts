import { NextResponse, type NextRequest } from "next/server";
import { getDeal, roomAccess } from "@/lib/deals";
import { getUser, log } from "@/lib/auth";
import { track } from "@/lib/track";

/* Layer 3: the data bank (a Google Drive folder) opens only from the NDA room. Every open is logged against
   the person and office, so the desk knows who went past the deck into the proprietary material. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/room/${slug}#Documents`)}`, req.url));
  const d = await getDeal(slug);
  if (!d) return new NextResponse("Not found", { status: 404 });
  const access = await roomAccess(user, d);
  if (access.state !== "open") return NextResponse.redirect(new URL(`/deals/${d.slug}`, req.url));
  if (!d.dataRoomUrl) return NextResponse.redirect(new URL(`/room/${d.slug}#Documents`, req.url));
  if (!access.admin) await track("databank_opened", { officeId: user.officeId, userId: user.id, dealId: d.id });
  await log(user, `Opened the data bank: ${d.company}`, d.id);
  return NextResponse.redirect(d.dataRoomUrl, 302);
}
