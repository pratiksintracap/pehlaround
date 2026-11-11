import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, ipoBids, offices, users } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { isSuper } from "@/lib/perm";
import { IPO_CATEGORY, type IpoCategory } from "@/lib/ipo";

const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** The interest registered in one issue, as a CSV for the lead manager. Names and contact details: super admin only. */
export async function GET(req: NextRequest) {
  const me = await getUser();
  if (!isSuper(me)) return NextResponse.json({ error: "Super admin only" }, { status: 403 });
  const dealId = Number(req.nextUrl.searchParams.get("deal"));
  const db = await getDb();
  const [d] = await db.select({ id: deals.id, company: deals.company, slug: deals.slug }).from(deals).where(and(eq(deals.id, dealId), eq(deals.listed, false)));
  if (!d) return NextResponse.json({ error: "No such issue" }, { status: 404 });
  const bids = await db.select().from(ipoBids).where(and(eq(ipoBids.dealId, d.id), ne(ipoBids.status, "Withdrawn")));
  const oIds = [...new Set(bids.map((b) => b.officeId))];
  const os = oIds.length ? await db.select({ id: offices.id, name: offices.name, entityName: offices.entityName, category: offices.category, referredBy: offices.referredBy }).from(offices).where(inArray(offices.id, oIds)) : [];
  const us = oIds.length ? await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users).where(inArray(users.officeId, oIds)) : [];
  const fIds = [...new Set(os.map((o) => o.referredBy).filter((x): x is number => !!x))];
  const fs = fIds.length ? await db.select({ id: offices.id, name: offices.name }).from(offices).where(inArray(offices.id, fIds)) : [];
  const office = new Map(os.map((o) => [o.id, o])), user = new Map(us.map((u) => [u.id, u])), firm = new Map(fs.map((f) => [f.id, f.name]));
  const rows: unknown[][] = [["Office", "Investing entity", "Invests as", "Contact", "Email", "Mobile", "Category", "Amount (Rs lakh)", "Applying through", "Introduced by", "Status", "Registered on"]];
  for (const b of bids) { const o = office.get(b.officeId), u = user.get(b.userId);
    rows.push([o?.name, o?.entityName, o?.category, u?.name, u?.email, u?.phone, IPO_CATEGORY[b.category as IpoCategory]?.label ?? b.category, Math.round(Number(b.amountCr) * 10000) / 100, b.broker, (o?.referredBy && firm.get(o.referredBy)) || "", b.status, b.createdAt.toISOString().slice(0, 10)]); }
  await log(me, `Desk exported the IPO book for ${d.company} (${bids.length} offices)`, d.id, { entity: "deal", entityId: d.id });
  return new NextResponse("﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ipo-book-${d.slug}.csv"`, "cache-control": "no-store" } });
}
