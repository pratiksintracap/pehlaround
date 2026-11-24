import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, deskNotes, tasks } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { isDesk } from "@/lib/perm";
import { deskDeals, deskMembers } from "@/lib/desk";
import { istDay, stageLabel } from "@/lib/stages";

// Desk only: the deal pipeline as a CSV that opens in Excel. Takes the board's own filters (who, kind) so the export
// matches what is on screen; archived deals are left out unless archived=1.
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const day = (d: Date | null | undefined) => (d ? istDay(new Date(d)) : "");

export async function GET(req: NextRequest) {
  const me = await getUser();
  if (!isDesk(me)) return NextResponse.json({ error: "Desk only" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const who = sp.get("who"), kind = sp.get("kind"), withArchived = sp.get("archived") === "1";
  const ownerFilter = who === "me" ? me!.id : who === "none" ? null : who ? Number(who) : undefined;
  const [all, members] = await Promise.all([deskDeals(), deskMembers()]);
  const list = all.filter((d) => (withArchived || d.pipelineStage !== "archived")
    && (ownerFilter === undefined || d.ownerId === ownerFilter)
    && (!kind || (kind === "listed" ? d.listed : kind === "debt" ? d.debt : !d.listed && !d.debt)));
  const ids = list.map((d) => d.id);
  const db = await getDb();
  const today = istDay();
  const [open, last, notes] = ids.length ? await Promise.all([
    db.select({ dealId: tasks.dealId, title: tasks.title, dueOn: tasks.dueOn }).from(tasks).where(and(eq(tasks.status, "open"), inArray(tasks.dealId, ids))),
    db.select({ dealId: audit.dealId, at: sql<Date>`max(${audit.at})` }).from(audit).where(and(isNotNull(audit.dealId), inArray(audit.dealId, ids))).groupBy(audit.dealId),
    db.select({ dealId: deskNotes.dealId, body: deskNotes.body, at: deskNotes.createdAt }).from(deskNotes).where(inArray(deskNotes.dealId, ids)).orderBy(desc(deskNotes.createdAt)),
  ]) : [[], [], []];
  const owner = new Map(members.map((m) => [m.id, m.name]));
  const lastAt = new Map(last.map((r) => [r.dealId, new Date(r.at)]));
  const latestNote = new Map<number, { body: string; at: Date }>();
  for (const n of notes) if (n.dealId && !latestNote.has(n.dealId)) latestNote.set(n.dealId, n);

  const rows: unknown[][] = [["Deal", "Book", "Stage", "In stage since", "Owner", "On the site", "Round (Rs Cr)", "Pre-money",
    "Debt facility", "Debt amount (Rs Cr)", "Rate", "Tenor (months)", "Source", "Open tasks", "Overdue tasks", "Next task", "Next task due",
    "Last activity", "Latest desk note", "Note date"]];
  for (const d of list) {
    const t = open.filter((x) => x.dealId === d.id).sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
    const info = (d.debtInfo ?? {}) as Record<string, unknown>;
    const n = latestNote.get(d.id);
    rows.push([
      d.company, d.listed ? "After the Bell" : d.debt ? "Debt" : "Before the Bell", stageLabel(d.pipelineStage), day(d.stageAt),
      d.ownerId ? owner.get(d.ownerId) ?? "" : "", d.published ? "Yes" : "No", d.roundCr ?? "", d.preMoney ?? "",
      d.debt ? info.facility ?? "" : "", d.debt ? info.amountCr ?? "" : "", d.debt ? info.rateBand ?? "" : "", d.debt ? info.tenorMonths ?? "" : "", info.source ?? "",
      t.length, t.filter((x) => x.dueOn && x.dueOn < today).length, t[0]?.title ?? "", t[0]?.dueOn ?? "",
      day(lastAt.get(d.id)), n ? n.body.replace(/\s+/g, " ").slice(0, 500) : "", n ? day(n.at) : "",
    ]);
  }
  await log(me, `Desk exported the deal pipeline (${list.length} deals)`, null, { entity: "deal" });
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, { headers: {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="deal-pipeline-${today}.csv"`,
    "cache-control": "no-store",
  } });
}
