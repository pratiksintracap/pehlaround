import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealLinks, deals, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { investorWhere } from "@/lib/deal-guard";

/** A personal deal link from the desk: straight to that deal's NDA, through sign-in or a prefilled, pre-approved registration. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const go = (p: string) => NextResponse.redirect(new URL(p, req.url));
  const db = await getDb();
  const [l] = await db.select().from(dealLinks).where(eq(dealLinks.token, token));
  if (!l) return go("/deals");
  const [d] = await db.select({ slug: deals.slug, published: deals.published }).from(deals).where(investorWhere(eq(deals.id, l.dealId)));
  if (!d || !d.published) return go("/deals");
  await db.update(dealLinks).set({ opens: sql`${dealLinks.opens} + 1`, openedAt: l.openedAt ?? new Date() }).where(eq(dealLinks.id, l.id));
  const target = `/deals/${d.slug}#sign`;
  if (await getUser()) return go(target);
  if (l.officeId) return go(`/login?next=${encodeURIComponent(target)}`);
  const [u] = l.email ? await db.select({ id: users.id }).from(users).where(eq(users.email, l.email)) : [];
  if (u) return go(`/login?next=${encodeURIComponent(target)}`);
  return go(`/register?link=${encodeURIComponent(token)}`);
}
