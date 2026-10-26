import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { and, ne } from "drizzle-orm";
import { deals, documents, docViews, interests } from "@/db/schema";
import { getUser, log, clientIp } from "@/lib/auth";
import { roomAccess, docAccess, canSeeNames, isPreNda } from "@/lib/deals";
import { track } from "@/lib/track";
import { investorWhere } from "@/lib/deal-guard";
import { embeddable } from "@/lib/embed";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const db = await getDb();
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const [d] = await db.select().from(deals).where(investorWhere(eq(deals.id, doc.dealId)));
  if (!d) return new NextResponse("Not found", { status: 404 }); // a listed company's file never opens here
  const access = await roomAccess(user, d);
  const admin = access.state === "open" && !!access.admin;
  // Layer 2: the pitch deck, IM or teaser opens to every approved investor from the deal's overview, before any NDA.
  const preNda = isPreNda(doc) && (d.published || admin) && (await canSeeNames(user));
  if (!preNda && access.state !== "open") return NextResponse.redirect(new URL(isPreNda(doc) ? `/deals/${d.slug}` : `/room/${d.slug}`, req.url));
  const backTo = preNda && access.state !== "open" ? `/deals/${d.slug}#deck` : `/room/${d.slug}#Documents`;
  if (!doc.url || doc.status !== "available") return NextResponse.redirect(new URL(backTo, req.url));
  const [inter] = user.officeId ? await db.select({ id: interests.id }).from(interests).where(and(eq(interests.dealId, d.id), eq(interests.officeId, user.officeId), ne(interests.status, "Withdrawn"))) : [];
  if (docAccess(doc, user.officeId, !!inter, admin) !== "yes") return NextResponse.redirect(new URL(backTo, req.url));
  await db.insert(docViews).values({ documentId: doc.id, userId: user.id, officeId: user.officeId, ip: await clientIp() });
  if (isPreNda(doc) && !admin) await track("deck_opened", { officeId: user.officeId, userId: user.id, dealId: d.id, meta: { document: doc.id, title: doc.title } });
  await log(user, `${isPreNda(doc) ? "Opened" : "Viewed"} ${doc.title}: ${d.company}`, d.id);
  // ?embed=1: the same file in a form that shows inside a side panel (Google Drive, Docs and Slides have a /preview view).
  return NextResponse.redirect(req.nextUrl.searchParams.get("embed") === "1" ? embeddable(doc.url) : doc.url, 302);
}
