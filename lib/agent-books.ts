import "server-only";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deskNotes, interests, kycFiles, ndas, offices } from "@/db/schema";
import { deskDeals } from "@/lib/desk";
import { istDay, stageLabel } from "@/lib/stages";

// More of what the desk's assistant reads through the sealed exchange (see lib/agent-desk.ts and lib/agent-inbox.ts):
//  - offices_new: investor offices that registered recently or still wait for approval, as the profile they gave the
//    desk, so each can be researched and matched to deals. Never PAN, contact details, documents or KYC files themselves.
//  - listed: the After the Bell book (listed-company deals), for building institution lists. Console only, as ever.
//  - compliance: places where the desk's own rules are not met yet (an allocation moving without an NDA or KYC).
// Its only write here is a desk note on an office.

const BY = "Claude (assistant)";
const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const KYC_KINDS = ["cml", "cheque", "authority"];

export async function newOffices() {
  const db = await getDb();
  const since = new Date(Date.now() - 14 * 864e5);
  const rows = (await db.select().from(offices).where(or(gte(offices.createdAt, since), eq(offices.approval, "pending"))).orderBy(desc(offices.createdAt)))
    .filter((o) => o.investorType !== "broker" && o.origin === "registered").slice(0, 40);
  const ids = rows.map((o) => o.id);
  const [signed, kyc, notes, all] = await Promise.all([
    ids.length ? db.select({ officeId: ndas.officeId }).from(ndas).where(and(inArray(ndas.officeId, ids), isNull(ndas.revokedAt))) : [],
    ids.length ? db.select({ officeId: kycFiles.officeId, kind: kycFiles.kind, status: kycFiles.status }).from(kycFiles).where(and(inArray(kycFiles.officeId, ids), isNull(kycFiles.replacedAt))) : [],
    ids.length ? db.select({ officeId: deskNotes.officeId, who: deskNotes.who }).from(deskNotes).where(inArray(deskNotes.officeId, ids)) : [],
    deskDeals({ kind: "equity" }),
  ]);
  return {
    today: istDay(),
    offices: rows.map((o) => ({ name: o.name, type: o.investorType, category: o.category, city: o.city, website: o.website, sectors: o.sectors, ticket: o.ticket, aum: o.aum,
      structures: o.structures, horizon: o.horizon, thesis: o.thesis, coLead: o.coLead, registered: o.createdAt.toISOString().slice(0, 10), panCheck: o.status, approval: o.approval,
      ndasSigned: signed.filter((x) => x.officeId === o.id).length,
      kyc: Object.fromEntries(KYC_KINDS.map((k) => [k, kyc.find((x) => x.officeId === o.id && x.kind === k)?.status ?? "missing"])),
      hasAssistantNote: notes.some((x) => x.officeId === o.id && x.who === BY) })),
    openDeals: all.filter((d) => d.phase !== "preparing" && d.phase !== "closed" && d.pipelineStage !== "archived").map((d) => ({ company: d.company, sector: d.title, category: d.category, headline: d.headline, round: d.room.round })),
  };
}

export async function listedBook() {
  const db = await getDb();
  const list = (await deskDeals({ kind: "listed" })).filter((d) => d.pipelineStage !== "closed" && d.pipelineStage !== "archived");
  const notes = list.length ? await db.select({ dealId: deskNotes.dealId, body: deskNotes.body, who: deskNotes.who, at: deskNotes.createdAt }).from(deskNotes)
    .where(inArray(deskNotes.dealId, list.map((d) => d.id))).orderBy(desc(deskNotes.createdAt)) : [];
  return { today: istDay(), deals: list.map((d) => { const mine = notes.filter((x) => x.dealId === d.id);
    return { company: d.company, stage: stageLabel(d.pipelineStage), summary: d.headline, updated: d.updatedAt.toISOString().slice(0, 10), ...d.listedInfo,
      lastPlacementNote: mine.find((x) => x.who === BY && x.body.startsWith("Placement"))?.at.toISOString().slice(0, 10) ?? null,
      notes: mine.slice(0, 3).map((x) => ({ who: x.who, on: x.at.toISOString().slice(0, 10), body: x.body.slice(0, 800) })) }; }) };
}

/** Where the desk's own rules are not met yet. Read only. */
export async function complianceGaps() {
  const db = await getDb();
  const moving = await db.select().from(interests).where(inArray(interests.status, ["Term sheet", "Documents", "Allotted"]));
  const officeIds = [...new Set(moving.map((i) => i.officeId))];
  const [offs, signed, kyc, all] = await Promise.all([
    officeIds.length ? db.select({ id: offices.id, name: offices.name, approval: offices.approval, status: offices.status }).from(offices).where(inArray(offices.id, officeIds)) : [],
    officeIds.length ? db.select({ officeId: ndas.officeId, dealId: ndas.dealId }).from(ndas).where(and(inArray(ndas.officeId, officeIds), isNull(ndas.revokedAt))) : [],
    officeIds.length ? db.select({ officeId: kycFiles.officeId, kind: kycFiles.kind, status: kycFiles.status }).from(kycFiles).where(and(inArray(kycFiles.officeId, officeIds), isNull(kycFiles.replacedAt))) : [],
    deskDeals({ kind: "equity" }),
  ]);
  const company = new Map(all.map((d) => [d.id, d.company]));
  const gaps = moving.flatMap((i) => {
    const o = offs.find((x) => x.id === i.officeId);
    const missing = [
      !signed.some((x) => x.officeId === i.officeId && x.dealId === i.dealId) && "no signed NDA for this company",
      o && o.approval !== "approved" && "office not approved",
      o && o.status !== "verified" && "PAN not verified",
      ...KYC_KINDS.map((k) => { const f = kyc.find((x) => x.officeId === i.officeId && x.kind === k); return !f ? `KYC ${k} missing` : f.status !== "accepted" ? `KYC ${k} not accepted yet` : false; }),
    ].filter(Boolean);
    return missing.length ? [{ company: company.get(i.dealId) ?? `deal ${i.dealId}`, office: o?.name ?? `office ${i.officeId}`, stage: i.status, missing }] : [];
  });
  const open = all.filter((d) => d.phase !== "preparing" && d.pipelineStage !== "archived");
  return { today: istDay(), allocationsMoving: moving.length, gaps,
    roomsWithoutRisks: open.filter((d) => !d.room.risks.length).map((d) => d.company),
    publicDeals: open.map((d) => d.company) };
}

export async function booksAction(b: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (b.action !== "office_note") return null;
  const db = await getDb();
  const name = s(b.office, 200).toLowerCase(), text = s(b.body, 4000);
  const hits = name ? (await db.select({ id: offices.id, name: offices.name }).from(offices)).filter((o) => o.name.toLowerCase() === name) : [];
  if (hits.length !== 1 || text.length < 10) return { error: "Give the office's exact name and a note." };
  await db.insert(deskNotes).values({ officeId: hits[0].id, body: text, who: BY });
  return { ok: true, office: hits[0].name, log: { text: "Assistant added a desk note on an investor office", dealId: null } };
}
