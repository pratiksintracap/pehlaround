import "server-only";
// The daily desk report (MIS): a start-of-day plan and an end-of-day account for one desk member, built from what the
// portal already records (tasks, the audit trail, deal stages, new investors and leads), so nobody writes it by hand.
// The member downloads it (PDF) or copies it (text) and sends it on WhatsApp; each download is logged, and at the cut-off
// the desk emails the same report to the recipients with whether it was received (see runDayReportEmails).
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getDb } from "@/lib/db";
import { audit, deals, leads, offices, settings, tasks, users } from "@/db/schema";
import { istDay, stageLabel } from "@/lib/stages";
import { emailReady, sendRaw, layout, E, esc } from "@/lib/email";

export type ReportKind = "start" | "end";
export type Book = "before" | "after" | "debt" | "misc";
export const BOOKS: { k: Book; label: string }[] = [
  { k: "before", label: "Before the Bell" }, { k: "after", label: "After the Bell" }, { k: "debt", label: "Debt" }, { k: "misc", label: "Misc." },
];
export const KIND_LABEL: Record<ReportKind, string> = { start: "Start of day", end: "End of day" };

type Line = { text: string; deal?: string | null; extra?: string | null };
type Block = { title: string; lines: Line[] };
export type DayReport = {
  kind: ReportKind; day: string; person: { id: number; name: string }; at: Date; note?: string;
  counts: { label: string; n: number }[];
  books: { k: Book; label: string; blocks: Block[] }[];
  desk: Block[];                                   // desk-wide deal flow (end of day) or what needs the desk (start)
};

// ---------------------------------------------------------------- settings
export type ReportSettings = { from: number[]; to: string[]; cutoff: string; saturdays: boolean };
const SKEY = "dayReport";
export async function reportSettings(): Promise<ReportSettings> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, SKEY));
  let saved: Partial<ReportSettings> = {};
  try { saved = row?.value ? JSON.parse(row.value) : {}; } catch { saved = {}; }
  const desk = await deskPeople();
  // Defaults: reports go to the super admin pratik@ (or every super admin), and come from every other active desk member.
  const supers = desk.filter((u) => u.role === "admin");
  const owner = supers.find((u) => u.email.toLowerCase().startsWith("pratik@"));
  const to = saved.to?.length ? saved.to : owner ? [owner.email] : supers.map((u) => u.email);
  const from = saved.from ?? desk.filter((u) => !to.includes(u.email) && !/assistant|claude|test/i.test(`${u.name} ${u.email}`)).map((u) => u.id);
  return { from, to, cutoff: /^\d{2}:\d{2}$/.test(saved.cutoff ?? "") ? saved.cutoff! : "19:30", saturdays: !!saved.saturdays };
}
export async function saveReportSettings(s: ReportSettings) {
  const db = await getDb();
  const value = JSON.stringify(s);
  await db.insert(settings).values({ key: SKEY, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
export async function deskPeople() {
  const db = await getDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users)
    .where(and(inArray(users.role, ["admin", "analyst"]), eq(users.disabled, false))).orderBy(asc(users.name));
}

// ---------------------------------------------------------------- time
/** The UTC instants an IST calendar day starts and ends. */
export function istBounds(day: string) {
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - 5.5 * 36e5);
  return { start, end: new Date(start.getTime() + 864e5) };
}
const istTime = (d: Date) => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(11, 16);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
export const prettyDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** Whether reports are expected on this IST day (weekdays, and Saturdays when switched on). */
export const workingDay = (day: string, saturdays: boolean) => { const w = new Date(`${day}T00:00:00Z`).getUTCDay(); return w >= 1 && w <= (saturdays ? 6 : 5); };

// ---------------------------------------------------------------- building the report
export async function buildDayReport(kind: ReportKind, personId: number, day = istDay(), note?: string): Promise<DayReport | null> {
  const db = await getDb();
  const [p] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, personId));
  if (!p) return null;
  const { start, end } = istBounds(day);
  const allDeals = await db.select({ id: deals.id, company: deals.company, listed: deals.listed, debt: deals.debt, ownerId: deals.ownerId, stage: deals.pipelineStage }).from(deals);
  const dm = new Map(allDeals.map((d) => [d.id, d]));
  const bookOf = (dealId: number | null | undefined): Book => { const d = dealId ? dm.get(dealId) : undefined; return !d ? "misc" : d.listed ? "after" : d.debt ? "debt" : "before"; };
  const dealName = (id: number | null | undefined) => (id ? dm.get(id)?.company ?? null : null);
  const empty = () => new Map<Book, Block[]>(BOOKS.map((b) => [b.k, []]));
  const per = empty();
  const add = (book: Book, title: string, lines: Line[]) => { if (lines.length) per.get(book)!.push({ title, lines }); };
  const byBook = <T extends { dealId: number | null }>(rows: T[]) => BOOKS.map((b) => [b.k, rows.filter((r) => bookOf(r.dealId) === b.k)] as const);
  const counts: { label: string; n: number }[] = [];
  const desk: Block[] = [];

  if (kind === "start") {
    const open = await db.select().from(tasks).where(and(eq(tasks.status, "open"), eq(tasks.assigneeId, p.id))).orderBy(asc(tasks.dueOn));
    const soon = addDays(day, 3);
    const over = open.filter((t) => t.dueOn && t.dueOn < day), today = open.filter((t) => t.dueOn === day);
    const next = open.filter((t) => t.dueOn && t.dueOn > day && t.dueOn <= soon), undated = open.filter((t) => !t.dueOn);
    for (const [k, rows] of byBook(over)) add(k, "Overdue", rows.map((t) => ({ text: t.title, deal: dealName(t.dealId), extra: `due ${t.dueOn}, ${daysBetween(t.dueOn!, day)} day${daysBetween(t.dueOn!, day) === 1 ? "" : "s"} late` })));
    for (const [k, rows] of byBook(today)) add(k, "Due today", rows.map((t) => ({ text: t.title, deal: dealName(t.dealId) })));
    for (const [k, rows] of byBook(next)) add(k, "Next three days", rows.map((t) => ({ text: t.title, deal: dealName(t.dealId), extra: `due ${t.dueOn}` })));
    for (const [k, rows] of byBook(undated)) add(k, "No due date", rows.map((t) => ({ text: t.title, deal: dealName(t.dealId) })));
    // Deals this person runs that have had no desk activity for a week.
    const mine = allDeals.filter((d) => d.ownerId === p.id && !["closed", "archived"].includes(d.stage));
    if (mine.length) {
      const last = await db.select({ dealId: audit.dealId, at: sql<Date>`max(${audit.at})` }).from(audit)
        .where(inArray(audit.dealId, mine.map((d) => d.id))).groupBy(audit.dealId);
      const lm = new Map(last.map((r) => [r.dealId, new Date(r.at)]));
      const quiet = mine.filter((d) => { const l = lm.get(d.id); return !l || l < new Date(start.getTime() - 7 * 864e5); })
        .map((d) => ({ dealId: d.id, d, l: lm.get(d.id) }));
      for (const [k, rows] of byBook(quiet)) add(k, "Your deals with no activity for 7+ days", rows.map((r) => ({ text: r.d.company, extra: `${stageLabel(r.d.stage)} · ${r.l ? `last activity ${istDay(r.l)}` : "no activity yet"}` })));
    }
    counts.push({ label: "Overdue", n: over.length }, { label: "Due today", n: today.length }, { label: "Next 3 days", n: next.length });
    // What came in since the last working day that the desk has not touched yet.
    const since = istBounds(addDays(day, -1)).start;
    const [newLeads, newOffices] = await Promise.all([
      db.select({ kind: leads.kind, company: leads.company, name: leads.name, status: leads.status }).from(leads).where(and(gte(leads.createdAt, since), lt(leads.createdAt, end))).orderBy(desc(leads.createdAt)),
      db.select({ name: offices.name, status: offices.status }).from(offices).where(and(gte(offices.createdAt, since), lt(offices.createdAt, end), ne(offices.status, "approved"))),
    ]);
    if (newLeads.length) desk.push({ title: "New leads since yesterday", lines: newLeads.map((l) => ({ text: l.company || l.name || "Lead", extra: `${l.kind} · ${l.status}` })) });
    if (newOffices.length) desk.push({ title: "Investors waiting for approval", lines: newOffices.map((o) => ({ text: o.name, extra: o.status })) });
  } else {
    const [done, added, slipped, acts, moves, newDeals, newLeads, newOffices] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.status, "done"), gte(tasks.doneAt, start), lt(tasks.doneAt, end),
        sql`(${tasks.assigneeId} = ${p.id} or ${tasks.doneBy} = ${p.name})`)).orderBy(asc(tasks.doneAt)),
      db.select().from(tasks).where(and(gte(tasks.createdAt, start), lt(tasks.createdAt, end), sql`(${tasks.createdById} = ${p.id} or ${tasks.createdBy} = ${p.name})`)).orderBy(asc(tasks.createdAt)),
      db.select().from(tasks).where(and(eq(tasks.status, "open"), eq(tasks.assigneeId, p.id), isNotNull(tasks.dueOn), lte(tasks.dueOn, day))).orderBy(asc(tasks.dueOn)),
      db.select({ action: audit.action, dealId: audit.dealId, entity: audit.entity, at: audit.at }).from(audit)
        .where(and(eq(audit.userId, p.id), gte(audit.at, start), lt(audit.at, end), sql`coalesce(${audit.entity}, '') not in ('task', 'day_report')`)).orderBy(asc(audit.at)),
      db.select({ action: audit.action, dealId: audit.dealId, who: audit.who, at: audit.at }).from(audit)
        .where(and(gte(audit.at, start), lt(audit.at, end), eq(audit.entity, "deal"), sql`(${audit.detail}->'changes'->'pipelineStage') is not null`)).orderBy(asc(audit.at)),
      // A deal counts as new on the day its first trail entry was written (deals carry no created date of their own).
      db.select({ dealId: audit.dealId }).from(audit).where(isNotNull(audit.dealId)).groupBy(audit.dealId)
        .having(sql`min(${audit.at}) >= ${start.toISOString()}::timestamptz and min(${audit.at}) < ${end.toISOString()}::timestamptz`).then((rows) => rows.map((r) => dm.get(r.dealId!)).filter((d): d is NonNullable<typeof d> => !!d)),
      db.select({ kind: leads.kind, company: leads.company, name: leads.name }).from(leads).where(and(gte(leads.createdAt, start), lt(leads.createdAt, end))),
      db.select({ name: offices.name, investorType: offices.investorType }).from(offices).where(and(gte(offices.createdAt, start), lt(offices.createdAt, end))),
    ]);
    for (const [k, rows] of byBook(done)) add(k, "Done", rows.map((t) => ({ text: t.title, deal: dealName(t.dealId), extra: t.doneAt ? istTime(t.doneAt) : null })));
    for (const [k, rows] of byBook(slipped)) add(k, "Due, not done", rows.map((t) => ({ text: t.title, deal: dealName(t.dealId), extra: t.dueOn! < day ? `due ${t.dueOn}, ${daysBetween(t.dueOn!, day)} day${daysBetween(t.dueOn!, day) === 1 ? "" : "s"} late` : "due today" })));
    for (const [k, rows] of byBook(added)) add(k, "New tasks", rows.map((t) => ({ text: t.title, deal: dealName(t.dealId), extra: t.dueOn ? `due ${t.dueOn}` : null })));
    // Browsing is not work: sign-ins, page loads and opening rooms stay out of the report.
    const NOISE = /^(Signed (in|out)|Desk loaded|Opened the room|Viewed|Downloaded)/i;
    const work = acts.filter((a) => !NOISE.test(a.action));
    for (const [k, rows] of byBook(work)) add(k, "Other updates", rows.map((a) => ({ text: a.action.replace(/^Desk /, ""), extra: istTime(a.at) })));
    counts.push({ label: "Done", n: done.length }, { label: "Due, not done", n: slipped.length }, { label: "New tasks", n: added.length }, { label: "Updates", n: work.length });
    if (moves.length) desk.push({ title: "Deals that changed stage", lines: moves.map((m) => ({ text: m.action.replace(/^(Desk|Assistant) moved /, ""), extra: m.who ?? null })) });
    if (newDeals.length) desk.push({ title: "New deals", lines: newDeals.map((d) => ({ text: d.company, extra: BOOKS.find((b) => b.k === bookOf(d.id))!.label })) });
    if (newOffices.length) desk.push({ title: "New investors", lines: newOffices.map((o) => ({ text: o.name, extra: o.investorType.replace(/_/g, " ") })) });
    if (newLeads.length) desk.push({ title: "New leads", lines: newLeads.map((l) => ({ text: l.company || l.name || "Lead", extra: l.kind })) });
  }
  return { kind, day, person: p, at: new Date(), note: note?.trim() || undefined, counts, books: BOOKS.map((b) => ({ ...b, blocks: per.get(b.k)! })), desk };
}

// ---------------------------------------------------------------- output
const title = (r: DayReport) => `${KIND_LABEL[r.kind]} report · ${r.person.name} · ${prettyDay(r.day)}`;
const lineText = (l: Line) => `${l.text}${l.deal ? ` (${l.deal})` : ""}${l.extra ? ` · ${l.extra}` : ""}`;

/** Plain text for WhatsApp (*bold* is WhatsApp's own bold). */
export function reportText(r: DayReport) {
  const out = [`*${title(r)}*`, r.counts.map((c) => `${c.label} ${c.n}`).join(" · ")];
  if (r.note) out.push("", `*Note:* ${r.note}`);
  for (const b of r.books) {
    if (!b.blocks.length) continue;
    out.push("", `*${b.label.toUpperCase()}*`);
    for (const blk of b.blocks) { out.push(`_${blk.title}_`); for (const l of blk.lines) out.push(`• ${lineText(l)}`); }
  }
  if (!r.books.some((b) => b.blocks.length)) out.push("", r.kind === "start" ? "Nothing due or overdue." : "No tasks or updates recorded in the portal today.");
  if (r.desk.length) { out.push("", "*DESK*"); for (const blk of r.desk) { out.push(`_${blk.title}_`); for (const l of blk.lines) out.push(`• ${lineText(l)}`); } }
  out.push("", `Generated from the Before the Bell desk at ${istTime(r.at)} IST.`);
  return out.join("\n");
}

/** The same report as email HTML. */
export function reportHtml(r: DayReport) {
  const parts = [E.h(title(r)), E.p(r.counts.map((c) => `<b>${c.n}</b> ${esc(c.label.toLowerCase())}`).join(" · "))];
  if (r.note) parts.push(E.p(`<b>Note:</b> ${esc(r.note)}`));
  const blocks = (bs: Block[]) => bs.map((blk) => E.p(`<i>${esc(blk.title)}</i>`) + E.list(blk.lines.map((l) => `${esc(l.text)}${l.deal ? ` <span style="color:#6b7590">· ${esc(l.deal)}</span>` : ""}${l.extra ? ` <span style="color:#6b7590">· ${esc(l.extra)}</span>` : ""}`))).join("");
  for (const b of r.books) if (b.blocks.length) parts.push(E.p(`<b>${esc(b.label)}</b>`), blocks(b.blocks));
  if (!r.books.some((b) => b.blocks.length)) parts.push(E.p(r.kind === "start" ? "Nothing due or overdue." : "No tasks or updates recorded in the portal today."));
  if (r.desk.length) parts.push(E.p("<b>Desk</b>"), blocks(r.desk));
  return parts.join("");
}

// Standard PDF fonts carry Latin characters only.
const safe = (s: string) => s.replace(/₹/g, "Rs ").replace(/→/g, "->").replace(/[^\x20-\x7E -ÿ‘’“”–—•]/g, "");
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = []; let line = "";
  for (const w of safe(text).split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out;
}

/** The report as a one-or-more page A4 PDF, for sending on WhatsApp. */
export async function reportPdf(r: DayReport) {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(title(r))); doc.setAuthor("Before the Bell desk");
  const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), it = await doc.embedFont(StandardFonts.HelveticaOblique);
  const W = 595, H = 842, M = 48, CW = W - 2 * M;
  const NAVY = rgb(0.043, 0.09, 0.19), INK2 = rgb(0.23, 0.27, 0.39), INK3 = rgb(0.42, 0.46, 0.56), BLUE = rgb(0.12, 0.31, 1), RULE = rgb(0.86, 0.88, 0.92);
  let page = doc.addPage([W, H]); let y = H - M;
  const need = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const text = (s: string, font = reg, size = 10, color = INK2, indent = 0, gap = 3) => {
    for (const l of wrap(s, font, size, CW - indent)) { need(size + gap); page.drawText(l, { x: M + indent, y: y - size, size, font, color }); y -= size + gap; }
  };
  page.drawText("Before the Bell", { x: M, y: y - 12, size: 12, font: bold, color: NAVY });
  const tag = safe(`${KIND_LABEL[r.kind]} report`);
  page.drawText(tag, { x: W - M - bold.widthOfTextAtSize(tag, 9), y: y - 10, size: 9, font: bold, color: BLUE });
  y -= 22; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: RULE }); y -= 14;
  text(`${r.person.name} · ${prettyDay(r.day)}`, bold, 16, NAVY, 0, 6);
  text(r.counts.map((c) => `${c.label}: ${c.n}`).join("    "), reg, 10.5, INK2, 0, 8);
  if (r.note) { y -= 4; text("Note", bold, 10, NAVY); text(r.note, reg, 10, INK2, 0, 4); }
  const blocks = (bs: Block[]) => {
    for (const blk of bs) {
      y -= 4; text(blk.title, it, 10, INK3);
      for (const l of blk.lines) {
        need(14);
        page.drawText("•", { x: M + 6, y: y - 10, size: 10, font: reg, color: INK3 });
        text(lineText(l), reg, 10, INK2, 16);
      }
    }
  };
  for (const b of r.books) {
    if (!b.blocks.length) continue;
    y -= 10; need(30); text(b.label.toUpperCase(), bold, 10.5, BLUE, 0, 2);
    page.drawLine({ start: { x: M, y: y - 1 }, end: { x: W - M, y: y - 1 }, thickness: 0.5, color: RULE }); y -= 4;
    blocks(b.blocks);
  }
  if (!r.books.some((b) => b.blocks.length)) { y -= 8; text(r.kind === "start" ? "Nothing due or overdue." : "No tasks or updates recorded in the portal today."); }
  if (r.desk.length) { y -= 10; need(30); text("DESK", bold, 10.5, BLUE, 0, 2); y -= 2; blocks(r.desk); }
  for (const pg of doc.getPages()) pg.drawText(safe(`Generated from the Before the Bell desk at ${istTime(r.at)} IST · desk only, not for circulation`), { x: M, y: 24, size: 7.5, font: reg, color: INK3 });
  return doc.save();
}
export const reportFileName = (r: DayReport) => `${r.kind === "start" ? "Start" : "End"}-of-day ${r.person.name.split(" ")[0]} ${r.day}.pdf`;

// ---------------------------------------------------------------- the record of who sent what
/** Logged when a desk member downloads or copies their report; this is what the cut-off check reads. */
export async function logReportTaken(u: { id: number; name: string }, r: DayReport, how: "pdf" | "text") {
  const db = await getDb();
  await db.insert(audit).values({ userId: u.id, who: u.name, action: `Day report (${r.kind}, ${r.day}) for ${r.person.name} taken as ${how} by ${u.name}`,
    entity: "day_report", entityId: r.person.id, detail: r.note ? { note: r.note } : null });
}
/** When each person first took their start / end report for each day in a range. */
export async function reportLog(fromDay: string, toDay: string) {
  const db = await getDb();
  const rows = await db.select({ entityId: audit.entityId, userId: audit.userId, action: audit.action, at: audit.at, detail: audit.detail }).from(audit)
    .where(and(eq(audit.entity, "day_report"), gte(audit.at, istBounds(fromDay).start), lt(audit.at, istBounds(toDay).end))).orderBy(asc(audit.at));
  const out = new Map<string, { at: Date; note?: string }>();
  for (const r of rows) {
    const m = /^Day report \((start|end), (\d{4}-\d{2}-\d{2})\)/.exec(r.action);
    if (!m || r.entityId !== r.userId) continue;                       // only a person's own report counts as sent by them
    const key = `${r.entityId}|${m[2]}|${m[1]}`;
    if (!out.has(key)) out.set(key, { at: new Date(r.at), note: r.detail?.note });
  }
  return out;
}
export const cutoffInstant = (day: string, cutoff: string) => new Date(Date.parse(`${day}T${cutoff}:00Z`) - 5.5 * 36e5);

// ---------------------------------------------------------------- scheduled emails to the recipients
/**
 * Morning (9 AM run): each sender's start-of-day plan, with whether yesterday's end-of-day report came in.
 * Evening (cut-off run): each sender's end-of-day report, saying whether they sent theirs by the cut-off; a missing one
 * goes out as a reminder to follow up. Each runs once per day (remembered in settings); weekends are skipped.
 */
export async function runDayReportEmails(kind: ReportKind, now = new Date(), force = false) {
  const day = istDay(now);
  const cfg = await reportSettings();
  if (!force && !workingDay(day, cfg.saturdays)) return { skipped: "not a working day" };
  const db = await getDb();
  const key = `dayReportSent:${kind}`;
  const [last] = await db.select().from(settings).where(eq(settings.key, key));
  if (!force && last?.value === day) return { skipped: "already sent today" };
  if (!cfg.from.length || !cfg.to.length) return { skipped: "no senders or recipients set" };
  const people = (await deskPeople()).filter((u) => cfg.from.includes(u.id));
  // The previous working day, for the morning's "did yesterday's report come in".
  let prev = addDays(day, -1);
  for (let i = 0; i < 6 && !workingDay(prev, cfg.saturdays); i++) prev = addDays(prev, -1);
  const log = await reportLog(prev, day);
  let sent = 0;
  for (const p of people) {
    const r = await buildDayReport(kind, p.id, day);
    if (!r) continue;
    let status: string, subject: string;
    if (kind === "end") {
      const got = log.get(`${p.id}|${day}|end`);
      const cut = cutoffInstant(day, cfg.cutoff);
      if (got?.note) r.note = got.note;
      if (got && got.at <= cut) { status = `<span style="color:#1e7d4f"><b>Received.</b></span> ${esc(p.name)} took the end-of-day report at ${istTime(got.at)} IST.`; subject = `End of day: ${p.name}, ${prettyDay(day)} (received ${istTime(got.at)})`; }
      else if (got) { status = `<span style="color:#b26a00"><b>Late.</b></span> ${esc(p.name)} took the end-of-day report at ${istTime(got.at)} IST, after the ${cfg.cutoff} cut-off.`; subject = `End of day: ${p.name}, ${prettyDay(day)} (late, ${istTime(got.at)})`; }
      else { status = `<span style="color:#c0392b"><b>Not received.</b></span> ${esc(p.name)} has not taken the end-of-day report by the ${cfg.cutoff} cut-off. Follow up with ${esc(p.name.split(" ")[0])}. The report below is what the portal shows for today.`; subject = `NOT RECEIVED: end-of-day report from ${p.name}, ${prettyDay(day)}`; }
    } else {
      const got = log.get(`${p.id}|${prev}|end`);
      status = got ? `${esc(p.name.split(" ")[0])}'s end-of-day report for ${prettyDay(prev)} came in at ${istTime(got.at)} IST.` : `<span style="color:#c0392b"><b>${esc(p.name.split(" ")[0])}'s end-of-day report for ${prettyDay(prev)} was not received.</b></span>`;
      subject = `Start of day: ${p.name}, ${prettyDay(day)}`;
    }
    if (emailReady()) {
      const pdf = await reportPdf(r);
      const body = E.p(status) + reportHtml(r) + E.btn("Open day reports", `/admin/reports?who=${p.id}&kind=${kind}&day=${day}`);
      await sendRaw(cfg.to, subject, layout(body, { preheader: subject, footer: "Desk only. Sent to the desk's report recipients; change them under Day report in the console." }),
        [{ filename: reportFileName(r), content: pdf }], undefined, { kind: `day-report-${kind}`, userId: p.id }).catch(() => null);
      sent++;
    }
  }
  await db.insert(settings).values({ key, value: day }).onConflictDoUpdate({ target: settings.key, set: { value: day, updatedAt: new Date() } });
  return { kind, day, people: sent };
}
