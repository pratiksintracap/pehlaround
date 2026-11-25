import { dealCheck } from "@/lib/agent-dealcheck";
import ART from "@/lib/deal-art.json";
import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, deals, leads, offices, questions, tasks, users } from "@/db/schema";
import { asStage, dealKind, istDay, stageLabel } from "@/lib/stages";
import { log } from "@/lib/auth";
import { deskDeals, deskMembers } from "@/lib/desk";
import { addProspect, prospectNames, updateProspect } from "@/lib/prospects";
import { debtBook, deskInbox, inboxAction, prepList, scorecard } from "@/lib/agent-inbox";
import { booksAction, complianceGaps, listedBook, newOffices } from "@/lib/agent-books";
import { gunzipSync } from "node:zlib";
import { poolMark, poolNext, poolStats, upsertPool, type PoolRow } from "@/lib/pool";

// The desk's scheduled assistant (morning brief, meeting follow-ups, weekly pipeline review) reads the desk through this
// endpoint and can make two small changes: add a task, or move a deal to another pipeline stage. Every change is logged
// under "Claude (assistant)". Requests arrive sealed through the repository's agent workflow (lib/agent-exchange.ts).
// It never returns investor documents, the NDAs or KYC files themselves, PAN or contact details. The onboarding and compliance
// reads (lib/agent-books.ts) return an office's own profile and which steps are complete, nothing more.

const WHO = { id: 0, name: "Claude (assistant)", officeId: null };

/** What the assistant reads: tasks due, the pipeline with quiet and unowned deals, the last day's leads. */
export async function deskBrief() {
  const db = await getDb();
  const today = istDay();
  const quietSince = new Date(Date.now() - 14 * 864e5);
  const since24 = new Date(Date.now() - 864e5);
  const desk = await deskMembers();
  const nameOf = (id: number | null) => desk.find((u) => u.id === id)?.name ?? null;

  const [open, dl, lastTouch, fresh, unanswered] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, notes: tasks.notes, dueOn: tasks.dueOn, assigneeId: tasks.assigneeId, dealId: tasks.dealId }).from(tasks)
      .where(and(eq(tasks.status, "open"), lte(tasks.dueOn, today))).orderBy(tasks.dueOn),
    deskDeals().then((all) => all.filter((d) => d.pipelineStage !== "archived").map((d) => ({ id: d.id, company: d.company, stage: d.pipelineStage, stageAt: d.stageAt, ownerId: d.ownerId, listed: d.listed, debt: d.debt, ipoOnly: d.ipoOnly, updatedAt: d.updatedAt }))),
    db.select({ dealId: audit.dealId, last: sql<Date>`max(${audit.at})` }).from(audit).groupBy(audit.dealId),
    db.select({ kind: leads.kind, name: leads.name, company: leads.company, at: leads.createdAt }).from(leads).where(gte(leads.createdAt, since24)).orderBy(desc(leads.createdAt)),
    db.select({ id: questions.id, dealId: questions.dealId }).from(questions).where(isNull(questions.answer)),
  ]);
  const last = new Map(lastTouch.map((r) => [r.dealId, new Date(r.last)]));
  const company = (id: number | null) => dl.find((d) => d.id === id)?.company ?? null;
  const pipeline = dl.map((d) => {
    const touched = [last.get(d.id), d.updatedAt, d.stageAt].filter(Boolean).sort((a, b) => +b! - +a!)[0] as Date;
    return { id: d.id, company: d.company, stage: d.stage, stageLabel: stageLabel(d.stage), owner: nameOf(d.ownerId), kind: dealKind(d),
      lastActivity: touched.toISOString().slice(0, 10), quiet: d.stage !== "closed" && touched < quietSince };
  });
  const newOffices = await db.select({ name: offices.name, at: offices.createdAt }).from(offices).where(gte(offices.createdAt, since24));

  return {
    today,
    tasksDue: open.map((t) => ({ ...t, assignee: nameOf(t.assigneeId), company: company(t.dealId), overdue: (t.dueOn ?? today) < today })),
    pipeline,
    unownedDeals: pipeline.filter((p) => !p.owner && p.stage !== "closed").map((p) => p.company),
    quietDeals: pipeline.filter((p) => p.quiet).map((p) => ({ company: p.company, stage: p.stageLabel, lastActivity: p.lastActivity })),
    last24h: { leads: fresh, newOffices: newOffices.map((o) => o.name) },
    unansweredQuestions: unanswered.length,
    deskMembers: desk.map((u) => u.name),
    stages: ["sourced", "diligence", "live", "interest", "docs", "escrow", "closed", "archived"],
  };
}

// { action: "task", title, notes?, dueOn?: "YYYY-MM-DD", company?, assignee? } or { action: "stage", company, stage, note }
// or the sourcing actions: { action: "prospects" } | { action: "prospect", company, ... } | { action: "prospect_update", company, status?, note? }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deskAction(b: Record<string, any>): Promise<Record<string, unknown>> {
  const db = await getDb();
  const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const findDeal = async (name: string) => {
    if (!name) return null;
    const n = name.toLowerCase();
    const rows = (await deskDeals()).filter((d) => d.company.toLowerCase().includes(n)).map((d) => ({ id: d.id, company: d.company, stage: d.pipelineStage }));
    return rows.length === 1 ? rows[0] : rows.length > 1 ? "ambiguous" : null;
  };
  // The one-off move of NBFC Desk's data into /credit (lib/credit/server/import.ts). Resumable: call until done.
  if (b.action === "credit_import") {
    const { creditImport } = await import("@/lib/credit/server/import");
    return creditImport();
  }
  if (b.action === "task") {
    const title = s(b.title, 200);
    if (!title) return ({ error: "A title is needed." });
    const d = await findDeal(s(b.company, 120));
    if (d === "ambiguous") return ({ error: "More than one deal matches that company; use a fuller name." });
    const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(s(b.dueOn, 10)) ? s(b.dueOn, 10) : istDay();
    const [a] = b.assignee ? await db.select({ id: users.id }).from(users).where(and(inArray(users.role, ["admin", "analyst"]), sql`lower(${users.name}) like ${"%" + s(b.assignee, 80).toLowerCase() + "%"}`)) : [];
    const [t] = await db.insert(tasks).values({ title, notes: s(b.notes, 2000) || null, dueOn, dealId: d?.id ?? null, assigneeId: a?.id ?? null, createdBy: WHO.name }).returning({ id: tasks.id });
    await log(WHO, `Assistant added a task: ${title}`, d?.id ?? null, { entity: "task", entityId: t.id });
    return ({ ok: true, taskId: t.id, company: d?.company ?? null });
  }
  // { action: "task_move", taskId, company } — puts a task on a different deal (company "" takes it off any deal).
  if (b.action === "task_move") {
    const id = Number(b.taskId);
    const [t] = Number.isInteger(id) && id > 0 ? await db.select({ id: tasks.id, title: tasks.title, dealId: tasks.dealId }).from(tasks).where(eq(tasks.id, id)) : [];
    if (!t) return ({ error: "No task with that id." });
    const name = s(b.company, 120);
    const d = name ? await findDeal(name) : null;
    if (name && (!d || d === "ambiguous")) return ({ error: "Name one deal." });
    const to = d && d !== "ambiguous" ? d : null;
    await db.update(tasks).set({ dealId: to?.id ?? null }).where(eq(tasks.id, id));
    await log(WHO, `Assistant moved the task "${t.title}" to ${to ? to.company : "no deal"}`, to?.id ?? null, { entity: "task", entityId: id, detail: { changes: { dealId: [t.dealId, to?.id ?? null] } } });
    return ({ ok: true, taskId: id, company: to?.company ?? null });
  }
  // { action: "owner", company, owner } — who on the desk owns a deal.
  // { action: "phase", company, phase, listing? } — puts a pre-IPO deal on the site (announced / open) or takes it down,
  // exactly like the one-click phase change on the deals list: no announcement is sent. Only when Pratik asks for it.
  // Listed, debt and IPO-only deals never go on the shelf.
  if (b.action === "phase") {
    const { isPhase, phaseInfo } = await import("@/lib/phase");
    const { revalidateTag } = await import("next/cache");
    const { PUBLIC_TAG } = await import("@/lib/cache");
    const d = await findDeal(s(b.company, 120));
    if (!d || d === "ambiguous") return ({ error: "Name one deal." });
    const to = s(b.phase, 20);
    if (!isPhase(to)) return ({ error: "Phase must be preparing, coming, announced, open or closed." });
    const [cur] = (await deskDeals()).filter((x) => x.id === d.id);
    if (!cur || cur.listed || cur.debt || cur.ipoOnly) return ({ error: "Only pre-IPO deals go on the shelf." });
    const listing = s(b.listing, 60);
    if (cur.phase === to && !listing) return ({ ok: true, unchanged: true });
    await db.update(deals).set({ phase: to, ...(listing ? { listingLabel: listing } : {}), updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant moved ${d.company} to ${phaseInfo(to).label.toLowerCase()} (no announcement sent)${listing ? `; listing set to ${listing}` : ""}`, d.id,
      { entity: "deal", entityId: d.id, detail: { changes: { phase: [cur.phase, to], ...(listing ? { listingLabel: [cur.listingLabel, listing] } : {}) } } });
    try { revalidateTag(PUBLIC_TAG); } catch { /* outside a request: the public cache refreshes on its own */ }
    return ({ ok: true, company: d.company, from: cur.phase, to, shown: phaseInfo(to).desk });
  }
  // { action: "card", company, title?, headline?, slug? } — the public card's anonymised title, one-line headline and link.
  if (b.action === "card") {
    const d = await findDeal(s(b.company, 120));
    if (!d || d === "ambiguous") return ({ error: "Name one deal." });
    const title = s(b.title, 120), headline = s(b.headline, 600);
    const slug = s(b.slug, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!title && !headline && !slug) return ({ error: "Give a title, a headline or a slug." });
    const all = await deskDeals();
    const [cur] = all.filter((x) => x.id === d.id);
    if (slug && all.some((x) => x.slug === slug && x.id !== d.id)) return ({ error: "That slug is taken." });
    await db.update(deals).set({ ...(title ? { title } : {}), ...(headline ? { headline } : {}), ...(slug ? { slug } : {}), updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant updated the card text of ${d.company}`, d.id, { entity: "deal", entityId: d.id,
      detail: { changes: { ...(title ? { title: [cur?.title, title] } : {}), ...(headline ? { headline: [cur?.headline, headline] } : {}), ...(slug ? { slug: [cur?.slug, slug] } : {}) } } });
    try { const { revalidateTag } = await import("next/cache"); const { PUBLIC_TAG } = await import("@/lib/cache"); revalidateTag(PUBLIC_TAG); } catch { /* refreshes on its own */ }
    return ({ ok: true, company: d.company });
  }
  // { action: "interest", company, name, firm?, status?, amountCr?, channel?, contact?, note?, lastOn? } — records who is
  // interested in a deal (as Pratik relays it from calls, WhatsApp, email). Matched by deal + name, so a resend updates.
  if (b.action === "interest") {
    const { dealInterest } = await import("@/db/schema");
    const { CHANNELS, interestLabel, isInterestStatus } = await import("@/lib/deal-interest");
    const d = await findDeal(s(b.company, 120));
    if (!d || d === "ambiguous") return ({ error: "Name one deal." });
    const name = s(b.name, 160);
    if (!name) return ({ error: "Give a name." });
    const amt = parseFloat(String(b.amountCr ?? "").replace(/[₹,\s]/g, ""));
    const chan = s(b.channel, 20).toLowerCase();
    const vals = {
      ...(b.firm !== undefined ? { firm: s(b.firm, 160) || null } : {}),
      ...(isInterestStatus(b.status) ? { status: String(b.status) } : {}),
      ...(b.amountCr !== undefined ? { amountCr: isFinite(amt) && amt > 0 ? amt : null } : {}),
      ...((CHANNELS as readonly string[]).includes(chan) ? { channel: chan } : {}),
      ...(b.contact !== undefined ? { contact: s(b.contact, 160) || null } : {}),
      ...(b.note !== undefined ? { note: s(b.note, 2000) || null } : {}),
      lastOn: /^\d{4}-\d{2}-\d{2}$/.test(s(b.lastOn, 10)) ? s(b.lastOn, 10) : istDay(),
    };
    const [prev] = await db.select().from(dealInterest).where(and(eq(dealInterest.dealId, d.id), sql`lower(${dealInterest.name}) = ${name.toLowerCase()}`));
    if (prev) {
      await db.update(dealInterest).set({ ...vals, updatedAt: new Date() }).where(eq(dealInterest.id, prev.id));
      const st = (vals as { status?: string }).status;
      await log(WHO, `Assistant interest · ${prev.name}${st && st !== prev.status ? `: ${interestLabel(prev.status)} → ${interestLabel(st)}` : " updated"}`, d.id, { entity: "interest", entityId: prev.id });
      return ({ ok: true, updated: true, company: d.company, name: prev.name });
    }
    const [row] = await db.insert(dealInterest).values({ dealId: d.id, name, status: "pitched", ...vals, createdBy: WHO.name }).returning({ id: dealInterest.id, status: dealInterest.status });
    await log(WHO, `Assistant interest · ${name}: ${interestLabel(row.status)}`, d.id, { entity: "interest", entityId: row.id });
    return ({ ok: true, added: true, company: d.company, name });
  }
  // { action: "room_replace", company, find, replace } — a wording fix in a deal's room (also when it is live), as Pratik
  // asks. Replaces one exact piece of text found in exactly one place in the room; anything else is refused.
  if (b.action === "room_replace") {
    const d = await findDeal(s(b.company, 120));
    if (!d || d === "ambiguous") return ({ error: "Name one deal." });
    const find = String(b.find ?? ""), repl = String(b.replace ?? "");
    if (find.length < 4 || find.length > 2000 || repl.length > 4000) return ({ error: "Give the exact text to find (4–2000 characters)." });
    const [cur] = (await deskDeals()).filter((x) => x.id === d.id);
    if (!cur) return ({ error: "Deal not found." });
    let hits = 0; const where: string[] = [];
    const walk = (v: unknown, path: string): unknown => {
      if (typeof v === "string") { const n = v.split(find).length - 1; if (n) { hits += n; where.push(path); return v.split(find).join(repl); } return v; }
      if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}[${i}]`));
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, path ? `${path}.${k}` : k)]));
      return v;
    };
    const room = walk(cur.room, "");
    if (hits !== 1) return ({ error: hits ? `That text appears ${hits} times; give a longer piece.` : "That text is not in the room." });
    await db.update(deals).set({ room: room as typeof cur.room, updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant edited the room text of ${d.company} (${where[0]})`, d.id, { entity: "deal", entityId: d.id, detail: { changes: { [`room.${where[0]}`]: [find, repl] } } });
    try { const { revalidateTag } = await import("next/cache"); const { PUBLIC_TAG } = await import("@/lib/cache"); revalidateTag(PUBLIC_TAG); } catch { /* refreshes on its own */ }
    return ({ ok: true, company: d.company, field: where[0] });
  }
  // { action: "match", company } — registered investors ranked by fit for a deal (lib/investor-match.ts), for outreach.
  if (b.action === "match") {
    const d = await findDeal(s(b.company, 120));
    if (!d || d === "ambiguous") return ({ error: "Name one deal." });
    const [cur] = (await deskDeals()).filter((x) => x.id === d.id);
    const { matchInvestors } = await import("@/lib/investor-match");
    const m = cur ? await matchInvestors(cur, Math.min(Number(b.n) || 15, 30)) : [];
    return ({ ok: true, company: d.company, matches: m.map((x) => ({ office: x.name, type: x.type, city: x.city, ticket: x.ticket, score: x.score, reasons: x.reasons, flags: x.flags,
      contactName: x.contact.name, contactEmail: x.contact.email, inRoom: x.inRoom, onInterestList: x.onList, approved: x.approval === "approved" })) });
  }
  // { action: "art", company, key } — sets a deal's card picture to one of the built-in drawings (lib/deal-art.json).
  // A picture the desk uploaded is never replaced this way.
  if (b.action === "art") {
    const d = await findDeal(s(b.company, 120));
    if (!d || d === "ambiguous") return ({ error: "Name one deal." });
    const key = s(b.key, 80);
    const svg = (ART as Record<string, string>)[key];
    if (!svg) return ({ error: `Unknown picture. Built-ins: ${Object.keys(ART).join(", ")}` });
    const [cur] = (await deskDeals()).filter((x) => x.id === d.id);
    if (cur?.art?.startsWith("<img")) return ({ error: "This deal has an uploaded picture; change it from the admin page." });
    await db.update(deals).set({ art: svg, updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant set the card picture of ${d.company} to ${key}`, d.id, { entity: "deal", entityId: d.id });
    return ({ ok: true, company: d.company, art: key });
  }
  if (b.action === "owner") {
    const d = await findDeal(s(b.company, 120));
    if (!d || d === "ambiguous") return ({ error: "Name one deal." });
    const want = s(b.owner, 80).toLowerCase();
    const who = (await deskMembers()).filter((u) => want && u.name.toLowerCase().includes(want));
    if (who.length !== 1) return ({ error: "Name one desk member." });
    await db.update(deals).set({ ownerId: who[0].id, updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant made ${who[0].name} owner of ${d.company}`, d.id, { entity: "deal", entityId: d.id });
    return ({ ok: true, company: d.company, owner: who[0].name });
  }
  // { action: "remove_empty", id } — deletes a deal added twice or by mistake, only while it is unpublished and has no
  // history of any kind (no task, note, file, NDA, document, question, view or link). Anything else is refused.
  if (b.action === "remove_empty") {
    const id = Number(b.id);
    const d = Number.isInteger(id) && id > 0 ? (await deskDeals()).find((x) => x.id === id) : undefined;
    if (!d) return ({ error: "No deal with that id." });
    if (d.published) return ({ error: "Published deals are not removed." });
    const tables = ["ndas", "sign_codes", "documents", "questions", "calls", "interests", "passes", "deal_prefs", "desk_notes", "desk_files", "tasks", "deal_links", "deal_views", "broadcasts", "tickets", "ai_chats", "events", "deal_images"];
    const busy: string[] = [];
    for (const t of tables) {
      const r = await db.execute(sql.raw(`select count(*)::int as n from "${t}" where deal_id = ${id}`)) as unknown as { rows: { n: number }[] };
      if (Number(r.rows[0]?.n ?? 0)) busy.push(t);
    }
    const [{ p }] = (await db.execute(sql`select count(*)::int as p from users where promoter_deal_id = ${id}`) as unknown as { rows: { p: number }[] }).rows;
    if (busy.length || Number(p)) return ({ error: `Not empty: ${[...busy, ...(Number(p) ? ["promoter login"] : [])].join(", ")}.` });
    await db.delete(deals).where(eq(deals.id, id));
    await log(WHO, `Assistant removed the empty deal #${id}: ${d.company}`, null, { entity: "deal", entityId: id });
    return ({ ok: true, removed: id, company: d.company });
  }
  if (b.action === "stage") {
    const d = await findDeal(s(b.company, 120));
    const stage = asStage(s(b.stage, 20));
    if (!d || d === "ambiguous" || !stage) return ({ error: "Name one deal and a valid stage." });
    if (stage === d.stage) return ({ ok: true, unchanged: true });
    await db.update(deals).set({ pipelineStage: stage, stageAt: new Date(), updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant moved ${d.company} from ${stageLabel(d.stage)} to ${stageLabel(stage)}${b.note ? `: ${s(b.note, 300)}` : ""}`, d.id,
      { entity: "deal", entityId: d.id, detail: { changes: { pipelineStage: [d.stage, stage] } } });
    return ({ ok: true, company: d.company, from: d.stage, to: stage });
  }
  // Deal sourcing (lib/prospects.ts): list what is already logged, add a find, or move one along.
  if (b.action === "prospects") return ({ ok: true, prospects: await prospectNames() });
  // { action: "prospect_details", status? } — the full rows (email sent, why it fits, contact) for writing follow-ups.
  if (b.action === "prospect_details") {
    const { prospects } = await import("@/db/schema");
    const st = s(b.status, 20) || "emailed";
    const rows = await db.select({ company: prospects.company, status: prospects.status, kind: prospects.kind, sector: prospects.sector, city: prospects.city,
      revenueCr: prospects.revenueCr, patCr: prospects.patCr, fy: prospects.fy, why: prospects.why, contactName: prospects.contactName, contactRole: prospects.contactRole,
      contactEmail: prospects.contactEmail, website: prospects.website, emailSubject: prospects.emailSubject, emailBody: prospects.emailBody, sends: prospects.sends,
      emailedAt: prospects.emailedAt, repliedAt: prospects.repliedAt, notes: prospects.notes }).from(prospects).where(eq(prospects.status, st));
    return ({ ok: true, count: rows.length, prospects: rows });
  }
  // The sourcing pool (lib/pool.ts): the next companies to check, and marking one skipped with the reason.
  // Loading the pool: rows as an array, or gzipped JSON in base64 so a large file fits in a few sealed requests.
  if (b.action === "pool_load") {
    let rows: PoolRow[] = [];
    try { rows = b.gz ? JSON.parse(gunzipSync(Buffer.from(String(b.gz), "base64"), { maxOutputLength: 4 * 1024 * 1024 }).toString("utf8")) : b.rows; } catch { return ({ error: "Unreadable rows." }); }
    if (!Array.isArray(rows) || rows.length > 1500) return ({ error: "Send at most 1,500 rows in one action." });
    let loaded = 0;
    for (let i = 0; i < rows.length; i += 400) loaded += await upsertPool(rows.slice(i, i + 400), s(b.source, 120) || "assistant");
    if (loaded) await log(WHO, `Assistant loaded ${loaded} companies into the sourcing pool`, null, { entity: "pool" });
    return ({ ok: true, loaded, pool: await poolStats() });
  }
  if (b.action === "pool_next") return ({ ok: true, pool: await poolStats(), companies: await poolNext(Number(b.n) || 40) });
  if (b.action === "pool_skip") return ({ ok: await poolMark(s(b.company, 200), `skipped: ${s(b.reason, 200) || "not a fit"}`) });
  if (b.action === "prospect") {
    const r = await addProspect(b, WHO.name);
    if ("ok" in r || "exists" in r) await poolMark(s(b.poolCompany, 200) || s(b.company, 200), "prospect");
    if ("ok" in r) await log(WHO, `Assistant found a prospect: ${s(b.company, 200)}`, null, { entity: "prospect", entityId: r.id });
    return r;
  }
  if (b.action === "prospect_update") {
    const r = await updateProspect(b, WHO.name);
    if ("ok" in r && r.from !== r.to) await log(WHO, `Assistant moved the prospect ${r.company} to ${r.to}${"taskId" in r ? " and added a call task" : ""}`, null, { entity: "prospect" });
    return r;
  }
  // The inbox, the debt book and the weekly scorecard (lib/agent-inbox.ts).
  if (b.action === "deal_check") return dealCheck(s(b.company, 120));
  if (b.action === "inbox") return deskInbox();
  if (b.action === "debt") return debtBook();
  if (b.action === "scorecard") return scorecard();
  // Day report setup: who must send one, who receives it, the cut-off, and who sent today's reports.
  if (b.action === "report_settings") {
    const { reportSettings, deskPeople, reportLog } = await import("@/lib/day-report");
    const [cfg, ppl] = await Promise.all([reportSettings(), deskPeople()]);
    const day = istDay(), log = await reportLog(day, day);
    return ({ ...cfg, from: ppl.filter((p) => cfg.from.includes(p.id)).map((p) => ({ id: p.id, name: p.name })),
      desk: ppl.map((p) => ({ id: p.id, name: p.name, role: p.role })), today: [...log.entries()].map(([k, v]) => ({ k, at: v.at })) });
  }
  if (b.action === "prep") return prepList();
  if (b.action === "offices_new") return newOffices();
  if (b.action === "listed") return listedBook();
  if (b.action === "compliance") return complianceGaps();
  const r = (await inboxAction(b)) ?? (await booksAction(b));
  if (r) {
    const l = r.log as { text: string; dealId: number | null } | undefined;
    if (l) { await log(WHO, l.text, l.dealId); delete r.log; }
    return r;
  }
  return ({ error: "Unknown action." });
}
