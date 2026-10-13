import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { and, ne } from "drizzle-orm";
import { deals, documents, docViews, interests } from "@/db/schema";
import { getUser, log, clientIp } from "@/lib/auth";
import { roomAccess, docAccess } from "@/lib/deals";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const db = await getDb();
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const [d] = await db.select().from(deals).where(eq(deals.id, doc.dealId));
  const access = await roomAccess(user, d);
  if (access.state !== "open") return NextResponse.redirect(new URL(`/room/${d.slug}`, req.url));
  if (!doc.url || doc.status !== "available") return NextResponse.redirect(new URL(`/room/${d.slug}#Documents`, req.url));
  const [inter] = user.officeId ? await db.select({ id: interests.id }).from(interests).where(and(eq(interests.dealId, d.id), eq(interests.officeId, user.officeId), ne(interests.status, "Withdrawn"))) : [];
  if (docAccess(doc, user.officeId, !!inter, !!access.admin) !== "yes") return NextResponse.redirect(new URL(`/room/${d.slug}#Documents`, req.url));
  await db.insert(docViews).values({ documentId: doc.id, userId: user.id, officeId: user.officeId, ip: await clientIp() });
  await log(user, `Viewed ${doc.title}: ${d.company}`, d.id);
  return NextResponse.redirect(doc.url, 302);
}
