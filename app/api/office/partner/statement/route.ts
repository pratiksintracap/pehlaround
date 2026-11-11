import { NextResponse } from "next/server";
import { getUser, log } from "@/lib/auth";
import { listDeals, canSeeNames } from "@/lib/deals";
import { partnerBook } from "@/lib/partner";

const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const day = (d: Date | null | undefined) => (d ? new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : "");

/** A partner firm's statement: one row per client per company, with the NDA date and what was asked for and allotted.
 *  The same scope as the partner desk: a principal gets the whole firm, a relationship manager their own clients. */
export async function GET() {
  const u = await getUser();
  const book = u ? await partnerBook(u) : null;
  if (!u || !book) return NextResponse.json({ error: "Not available" }, { status: 403 });
  const names = await canSeeNames(u);
  const deals = new Map((await listDeals()).map((d) => [d.id, names ? d.company : d.title]));
  const rm = new Map(book.people.map((p) => [p.id, p.name]));
  const rows: unknown[][] = [["Client", "Introduced by", "Client status", "Joined", "Company", "NDA signed", "Requested (Rs Cr)", "Request status", "Allotted (Rs Cr)"]];
  for (const c of book.clients) {
    const by = (c.rmId && rm.get(c.rmId)) || (book.admin ? "The firm's link" : u.name);
    const dealIds = [...new Set([...book.ndas.filter((n) => n.officeId === c.id).map((n) => n.dealId), ...book.asks.filter((a) => a.officeId === c.id).map((a) => a.dealId)])];
    if (!dealIds.length) rows.push([c.name, by, c.approval, day(c.createdAt), "", "", "", "", ""]);
    for (const id of dealIds) {
      const n = book.ndas.find((x) => x.officeId === c.id && x.dealId === id);
      const a = book.asks.filter((x) => x.officeId === c.id && x.dealId === id && x.status !== "Withdrawn");
      const asked = a.reduce((t, x) => t + Number(x.amountCr), 0), got = a.filter((x) => x.status === "Allotted").reduce((t, x) => t + Number(x.amountCr), 0);
      rows.push([c.name, by, c.approval, day(c.createdAt), deals.get(id) ?? "", day(n?.signedAt), asked || "", a[0]?.status ?? "", got || ""]);
    }
  }
  await log(u, "Downloaded the partner statement");
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="partner-statement-${day(new Date())}.csv"`, "cache-control": "no-store" } });
}
