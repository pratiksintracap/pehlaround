import "server-only";
// The desk one-pager: what moved since the last one, what is stuck, who is interested, how the team and sourcing did.
// Emailed (with a PDF) to the report recipients on the chosen days (default Mon, Wed, Fri and Sat) by the 9 AM run, and
// viewable any time at /admin/one-pager. Built from the portal only. Desk only.
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getDb } from "@/lib/db";
import { audit, dealInterest, interests, ndas, offices, prospects, settings, tasks } from "@/db/schema";
import { deskDeals, deskMembers } from "@/lib/desk";
import { istDay, stageLabel } from "@/lib/stages";
import { interestLabel, isWarm } from "@/lib/deal-interest";
import { emailReady, sendRaw, layout, E, esc } from "@/lib/email";
import { cutoffInstant, istBounds, prettyDay, reportLog, reportSettings } from "@/lib/day-report";

const KEY = "onePager";
export type OnePagerSettings = { days: number[] };            // 0 = Sunday … 6 = Saturday
export async function onePagerSettings(): Promise<OnePagerSettings> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  try { const v = row?.value ? JSON.parse(row.value) : null; if (v && Array.isArray(v.days)) return { days: v.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) }; } catch { /* default */ }
  return { days: [1, 3, 5, 6] };
}
export async function saveOnePagerSettings(s: OnePagerSettings) {
  const db = await getDb(); const value = JSON.stringify(s);
  await db.insert(settings).values({ key: KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
/** The previous one-pager day before `day` (the period this one covers starts there). */
export function previousDay(day: string, days: number[]) { for (let i = 1; i <= 7; i++) { const d = addDays(day, -i); if (days.includes(weekday(d))) return d; } return addDays(day, -2); }
const cr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
const book = (d: { listed: boolean; debt: boolean }) => (d.listed ? "After the Bell" : d.debt ? "Debt" : "Before the Bell");

export type Line = { text: string; sub?: string; warn?: boolean };
export type OnePager = { day: string; since: string; numbers: { k: string; v: string; s?: string }[]; sections: { title: string; lines: Line[]; empty: string }[] };

export async function buildOnePager(day = istDay()): Promise<OnePager> {
  const db = await getDb();
  const cfg = await onePagerSettings();
  const since = previousDay(day, cfg.days);
  const from = istBounds(addDays(since, 0)).start;             // from the start of the previous one-pager's day
  const to = istBounds(day).start;                              // up to this morning
  const all = await deskDeals();
  const active = all.filter((d) => !["closed", "archived"].includes(d.pipelineStage));
  const ids = all.map((d) => d.id);
  const [members, moves, created, openT, doneT, addedT, warm, pros, newOff, waitingOff, ndaN, allocs, lastAct] = await Promise.all([
    deskMembers(),
    db.select({ action: audit.action, dealId: audit.dealId, at: audit.at }).from(audit).where(and(gte(audit.at, from), lt(audit.at, to), eq(audit.entity, "deal"), sql`(${audit.detail}->'changes'->'pipelineStage') is not null`)).orderBy(asc(audit.at)),
    db.select({ dealId: audit.dealId }).from(audit).where(sql`${audit.dealId} is not null`).groupBy(audit.dealId).having(sql`min(${audit.at}) >= ${from.toISOString()}::timestamptz and min(${audit.at}) < ${to.toISOString()}::timestamptz`),
    db.select().from(tasks).where(eq(tasks.status, "open")),
    db.select({ assigneeId: tasks.assigneeId }).from(tasks).where(and(eq(tasks.status, "done"), gte(tasks.doneAt, from), lt(tasks.doneAt, to))),
    db.select({ assigneeId: tasks.assigneeId }).from(tasks).where(and(gte(tasks.createdAt, from), lt(tasks.createdAt, to))),
    ids.length ? db.select().from(dealInterest).where(inArray(dealInterest.dealId, ids)).orderBy(desc(dealInterest.updatedAt)) : Promise.resolve([]),
    db.select({ status: prospects.status, createdAt: prospects.createdAt, emailedAt: prospects.emailedAt, repliedAt: prospects.repliedAt, company: prospects.company }).from(prospects),
    db.select({ name: offices.name }).from(offices).where(and(gte(offices.createdAt, from), lt(offices.createdAt, to))),
    db.select({ name: offices.name, createdAt: offices.createdAt }).from(offices).where(eq(offices.approval, "pending")),
    db.select({ n: sql<number>`count(*)::int` }).from(ndas).where(and(gte(ndas.signedAt, from), lt(ndas.signedAt, to))),
    db.select({ dealId: interests.dealId, amountCr: interests.amountCr }).from(interests).where(and(gte(interests.createdAt, from), lt(interests.createdAt, to))),
    ids.length ? db.select({ dealId: audit.dealId, at: sql<Date>`max(${audit.at})` }).from(audit).where(inArray(audit.dealId, ids)).groupBy(audit.dealId) : Promise.resolve([]),
  ]);
  const name = new Map(members.map((m) => [m.id, m.name]));
  const dealOf = new Map(all.map((d) => [d.id, d]));
  const last = new Map(lastAct.map((r) => [r.dealId, new Date(r.at)]));

  // Numbers
  const byBook = (k: string) => active.filter((d) => book(d) === k);
  const preValue = byBook("Before the Bell").reduce((a, d) => a + (Number(d.roundCr) || 0), 0);
  const debtValue = byBook("Debt").reduce((a, d) => a + (Number((d.debtInfo as { amountCr?: number } | null)?.amountCr) || 0), 0);
  const firm = warm.filter((x) => x.status === "soft" || x.status === "committed").reduce((a, x) => a + (x.amountCr ?? 0), 0);
  const overdue = openT.filter((t) => t.dueOn && t.dueOn < day);
  const numbers = [
    { k: "Active deals", v: String(active.length), s: `${byBook("Before the Bell").length} pre-IPO · ${byBook("After the Bell").length} listed · ${byBook("Debt").length} debt` },
    { k: "Pre-IPO rounds", v: cr(preValue), s: "sum of round sizes set" },
    { k: "Debt asks", v: cr(debtValue), s: "sum of amounts set" },
    { k: "Soft or committed", v: cr(firm), s: `${warm.filter((x) => isWarm(x.status)).length} warm investors` },
    { k: "Overdue tasks", v: String(overdue.length), s: `${openT.length} open` },
  ];

  const sections: OnePager["sections"] = [];
  sections.push({ title: "Moved since the last one-pager", empty: "No deal changed stage.", lines: [
    ...created.map((r) => dealOf.get(r.dealId!)).filter(Boolean).map((d) => ({ text: `New: ${d!.company}`, sub: `${book(d!)} · ${stageLabel(d!.pipelineStage)}` })),
    ...moves.map((m) => ({ text: m.action.replace(/^(Desk|Assistant) moved /, ""), sub: book(dealOf.get(m.dealId!) ?? { listed: false, debt: false }) })),
  ] });
  const changed = warm.filter((x) => x.updatedAt >= from && x.updatedAt < to);
  sections.push({ title: "Investor interest", empty: "No interest recorded or updated.", lines: changed.slice(0, 10).map((x) => ({
    text: `${dealOf.get(x.dealId)?.company ?? "Deal"}: ${x.name}`, sub: `${interestLabel(x.status)}${x.amountCr ? ` · ${cr(x.amountCr)}` : ""}${x.note ? ` · ${x.note.slice(0, 80)}` : ""}`, warn: x.status === "passed" })) });
  const quiet = active.filter((d) => { const l = last.get(d.id); return !l || l < new Date(Date.now() - 7 * 864e5); })
    .sort((a, b) => (Number(b.roundCr) || 0) - (Number(a.roundCr) || 0)).slice(0, 6);
  const late = [...overdue].sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? "")).slice(0, 6);
  sections.push({ title: "Needs attention", empty: "Nothing overdue and no deal has gone quiet.", lines: [
    ...late.map((t) => ({ text: t.title, sub: `${t.assigneeId ? name.get(t.assigneeId) ?? "" : "Unassigned"} · ${Math.round((Date.parse(day) - Date.parse(t.dueOn!)) / 864e5)} days late${t.dealId && dealOf.get(t.dealId) ? ` · ${dealOf.get(t.dealId)!.company}` : ""}`, warn: true })),
    ...quiet.map((d) => ({ text: `${d.company} has gone quiet`, sub: `${book(d)} · ${stageLabel(d.pipelineStage)} · ${last.get(d.id) ? `last activity ${istDay(last.get(d.id)!)}` : "no activity logged"}` })),
  ] });

  // Team: day reports and tasks, per sender.
  const rs = await reportSettings();
  const log = await reportLog(since, addDays(day, -1));
  const team: Line[] = [];
  for (const id of rs.from) {
    const who = name.get(id); if (!who) continue;
    const marks: string[] = [];
    for (let d = since; d < day; d = addDays(d, 1)) {
      if (!(weekday(d) >= 1 && weekday(d) <= (rs.saturdays ? 6 : 5))) continue;
      const e = log.get(`${id}|${d}|end`);
      marks.push(`${prettyDay(d).split(",")[0]} ${e ? (e.at > cutoffInstant(d, rs.cutoff) ? "late" : "sent") : "missed"}`);
    }
    const done = doneT.filter((t) => t.assigneeId === id).length, added = addedT.filter((t) => t.assigneeId === id).length;
    team.push({ text: `${who}: ${done} task${done === 1 ? "" : "s"} done, ${added} added, ${openT.filter((t) => t.assigneeId === id && t.dueOn && t.dueOn < day).length} overdue`, sub: marks.length ? `End-of-day reports: ${marks.join(", ")}` : undefined, warn: marks.some((m) => m.endsWith("missed")) });
  }
  sections.push({ title: "Team", empty: "No one is set to send day reports.", lines: team });

  const inP = (d: Date | null) => !!d && d >= from && d < to;
  const replies = pros.filter((p) => inP(p.repliedAt));
  sections.push({ title: "Sourcing", empty: "", lines: [
    { text: `${pros.filter((p) => inP(p.createdAt)).length} found · ${pros.filter((p) => inP(p.emailedAt)).length} emailed · ${replies.length} replied · ${pros.filter((p) => p.status === "drafted").length} drafts waiting for approval` },
    ...replies.map((p) => ({ text: `Reply: ${p.company}`, sub: p.status === "interested" || p.status === "added" ? "Interested, now on the deal pipeline" : p.status === "declined" ? "Not interested" : "Read the reply" })),
  ] });
  const allocCr = allocs.reduce((a, x) => a + Number(x.amountCr || 0), 0);
  sections.push({ title: "Investors on the platform", empty: "", lines: [
    { text: `${newOff.length} new office${newOff.length === 1 ? "" : "s"}${newOff.length ? `: ${newOff.slice(0, 5).map((o) => o.name).join(", ")}` : ""}` },
    { text: `${ndaN[0]?.n ?? 0} NDAs signed · ${allocs.length} allocation request${allocs.length === 1 ? "" : "s"}${allocCr ? ` (${cr(allocCr)})` : ""}` },
    ...(waitingOff.length ? [{ text: `${waitingOff.length} waiting for approval`, sub: waitingOff.slice(0, 5).map((o) => `${o.name} (since ${istDay(o.createdAt)})`).join(", "), warn: waitingOff.some((o) => o.createdAt < new Date(Date.now() - 2 * 864e5)) }] : []),
  ] });
  return { day, since, numbers, sections };
}

// ---------------------------------------------------------------- output
export function onePagerHtml(p: OnePager) {
  const nums = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 14px"><tr>${p.numbers.map((n) => `<td style="padding:8px 10px;border:1px solid #e3e7ef;vertical-align:top"><div style="font-size:11px;color:#6b7590">${esc(n.k)}</div><div style="font-size:18px;font-weight:700;color:#0b1730">${esc(n.v)}</div>${n.s ? `<div style="font-size:11px;color:#6b7590">${esc(n.s)}</div>` : ""}</td>`).join("")}</tr></table>`;
  const secs = p.sections.map((s) => `<p style="margin:14px 0 4px"><b>${esc(s.title)}</b></p>${s.lines.length ? E.list(s.lines.map((l) => `<span${l.warn ? ' style="color:#b42318"' : ""}>${esc(l.text)}</span>${l.sub ? ` <span style="color:#6b7590">· ${esc(l.sub)}</span>` : ""}`)) : E.p(`<span style="color:#6b7590">${esc(s.empty)}</span>`)}`).join("");
  return E.h(`Desk one-pager · ${prettyDay(p.day)}`) + E.p(`<span style="color:#6b7590">Since ${prettyDay(p.since)}.</span>`) + nums + secs;
}

const safe = (s: string) => s.replace(/₹/g, "Rs ").replace(/→/g, "->").replace(/[^\x20-\x7E -ÿ‘’“”–—•]/g, "");
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = []; let line = "";
  for (const w of safe(text).split(/\s+/).filter(Boolean)) { const t = line ? `${line} ${w}` : w; if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
export async function onePagerPdf(p: OnePager) {
  const doc = await PDFDocument.create(); doc.setTitle(safe(`Desk one-pager ${p.day}`)); doc.setAuthor("Before the Bell desk");
  const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40, CW = W - 2 * M;
  const NAVY = rgb(0.043, 0.09, 0.19), INK2 = rgb(0.23, 0.27, 0.39), INK3 = rgb(0.42, 0.46, 0.56), BLUE = rgb(0.12, 0.31, 1), RULE = rgb(0.86, 0.88, 0.92), RED = rgb(0.71, 0.14, 0.09);
  let page = doc.addPage([W, H]); let y = H - M;
  const need = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const text = (s: string, font = reg, size = 9, color = INK2, indent = 0, gap = 2.5) => { for (const l of wrap(s, font, size, CW - indent)) { need(size + gap); page.drawText(l, { x: M + indent, y: y - size, size, font, color }); y -= size + gap; } };
  page.drawText("Before the Bell", { x: M, y: y - 12, size: 12, font: bold, color: NAVY });
  const tag = safe(`Desk one-pager · ${prettyDay(p.day)} · since ${prettyDay(p.since)}`);
  page.drawText(tag, { x: W - M - reg.widthOfTextAtSize(tag, 8.5), y: y - 10, size: 8.5, font: reg, color: INK3 });
  y -= 20; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: RULE }); y -= 8;
  const cw = CW / p.numbers.length;
  p.numbers.forEach((n, i) => { const x = M + i * cw;
    page.drawText(safe(n.k), { x, y: y - 8, size: 7.5, font: reg, color: INK3 });
    page.drawText(safe(n.v), { x, y: y - 24, size: 14, font: bold, color: NAVY });
    if (n.s) wrap(n.s, reg, 7, cw - 6).slice(0, 2).forEach((l, j) => page.drawText(l, { x, y: y - 34 - j * 8.5, size: 7, font: reg, color: INK3 })); });
  y -= 56;
  for (const s of p.sections) {
    need(28); y -= 6; text(s.title.toUpperCase(), bold, 9, BLUE, 0, 3);
    if (!s.lines.length) { text(s.empty, reg, 8.5, INK3); continue; }
    for (const l of s.lines) { text(`• ${l.text}`, l.warn ? bold : reg, 8.5, l.warn ? RED : INK2, 4); if (l.sub) text(l.sub, reg, 7.8, INK3, 12); }
  }
  for (const pg of doc.getPages()) pg.drawText("Built from the Before the Bell desk · desk only, not for circulation", { x: M, y: 20, size: 7, font: reg, color: INK3 });
  return doc.save();
}

/** The 9 AM run: on one-pager days, email it with the PDF to the report recipients, once a day. */
export async function runOnePager(now = new Date(), force = false) {
  const day = istDay(now);
  const cfg = await onePagerSettings();
  if (!force && !cfg.days.includes(weekday(day))) return { skipped: "not a one-pager day" };
  const db = await getDb();
  const [last] = await db.select().from(settings).where(eq(settings.key, "onePagerSent"));
  if (!force && last?.value === day) return { skipped: "already sent today" };
  const to = (await reportSettings()).to;
  if (!to.length) return { skipped: "no recipients" };
  const p = await buildOnePager(day);
  if (emailReady()) {
    const pdf = await onePagerPdf(p);
    await sendRaw(to, `Desk one-pager · ${prettyDay(day)}`, layout(onePagerHtml(p) + E.btn("Open the one-pager", "/admin/one-pager"), { preheader: `What moved since ${prettyDay(p.since)}`, footer: "Desk only. Sent on the days set under Day report → Settings." }),
      [{ filename: `Desk one-pager ${day}.pdf`, content: pdf }], undefined, { kind: "one-pager" }).catch(() => null);
  }
  await db.insert(settings).values({ key: "onePagerSent", value: day }).onConflictDoUpdate({ target: settings.key, set: { value: day, updatedAt: new Date() } });
  return { day, since: p.since, to: to.length };
}
