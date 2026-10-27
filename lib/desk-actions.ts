"use server";
// Desk workflow actions: deal stages and owners, desk notes, desk files, tasks, listed-company deals (After the Bell)
// and investors the desk adds by hand. Every rule is checked here on the server (lib/perm.ts); the admin UI only
// hides what a role cannot do. Every change is written to the audit trail with the fields that changed.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, deskFiles, deskNotes, kycFiles, offices, tasks, users, type ListedInfo } from "@/db/schema";
import { requirePerm, log, changes } from "@/lib/auth";
import { can } from "@/lib/perm";
import { asStage, stageLabel } from "@/lib/stages";
import { investorRows, investorType } from "@/lib/csv";
import { done, fail, deskBack, resultUrl } from "@/lib/form";
import { deskMembers, canSeeOffice, officeScope } from "@/lib/desk";

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const n = (f: FormData, k: string) => Number(f.get(k)) || 0;
/** Back to a desk page (only same-site admin or app-desk paths), with a message. */
const back = (f: FormData | null, fallback: string, msg: string): never => done(deskBack(f, fallback), msg);
const refuse = (f: FormData | null, fallback: string, msg: string): never => fail(deskBack(f, fallback), msg);
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const url = (v: string) => (/^https:\/\/\S+$/.test(v) ? v : null);

async function dealRow(id: number) {
  const db = await getDb();
  return (await db.select().from(deals).where(eq(deals.id, id)))[0] ?? null;
}
const dealPage = (d: { id: number; listed: boolean }) => (d.listed ? `/admin/after-the-bell/${d.id}` : `/admin/deals/${d.id}`);

// ---------------------------------------------------------------- stage and owner
export async function setDealStage(f: FormData) {
  const me = await requirePerm("workflow");
  const d = await dealRow(n(f, "id"));
  const stage = asStage(s(f, "stage", 20));
  if (!d || !stage) return refuse(f, "/admin/board", "Pick a stage.");
  if (d.pipelineStage === stage) return refuse(f, dealPage(d), "No change.");
  const db = await getDb();
  await db.update(deals).set({ pipelineStage: stage, stageAt: new Date() }).where(eq(deals.id, d.id));
  await log(me, `Desk moved ${d.company} to ${stageLabel(stage)}`, d.id, { entity: "deal", entityId: d.id, detail: { changes: { pipelineStage: [stageLabel(d.pipelineStage), stageLabel(stage)] } } });
  back(f, dealPage(d), `${d.company} is at ${stageLabel(stage)}. Nothing on the site changes with the stage.`);
}

export async function setDealOwner(f: FormData) {
  const me = await requirePerm("workflow");
  const d = await dealRow(n(f, "id"));
  if (!d) return refuse(f, "/admin/board", "Deal not found.");
  const ownerId = n(f, "ownerId") || null;
  const members = await deskMembers();
  if (ownerId && !members.some((m) => m.id === ownerId)) return refuse(f, dealPage(d), "Owners are desk members.");
  if (ownerId === d.ownerId) return refuse(f, dealPage(d), "No change.");
  const db = await getDb();
  await db.update(deals).set({ ownerId }).where(eq(deals.id, d.id));
  const nm = (id: number | null) => (id ? members.find((m) => m.id === id)?.name ?? `#${id}` : "nobody");
  await log(me, `Desk gave ${d.company} to ${nm(ownerId)}`, d.id, { entity: "deal", entityId: d.id, detail: { changes: { owner: [nm(d.ownerId), nm(ownerId)] } } });
  back(f, dealPage(d), ownerId ? `${nm(ownerId)} runs ${d.company} now.` : `${d.company} has no owner.`);
}

// ---------------------------------------------------------------- desk notes
export async function saveDeskNote(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const id = n(f, "id"), body = s(f, "body", 8000), dealId = n(f, "dealId") || null, officeId = n(f, "officeId") || null;
  const fallback = dealId ? `/admin/deals/${dealId}#desk` : "/admin/tasks";
  if (f.get("delete") === "on") {
    if (!can(me, "delete")) return refuse(f, fallback, "Only a super admin can delete a note.");
    const [prev] = await db.select().from(deskNotes).where(eq(deskNotes.id, id));
    if (!prev) return refuse(f, fallback, "Note not found.");
    await db.delete(deskNotes).where(eq(deskNotes.id, id));
    await log(me, "Desk deleted a note", prev.dealId, { entity: "note", entityId: id, officeId: prev.officeId, detail: { changes: { body: [prev.body, null] } } });
    return back(f, fallback, "Note deleted.");
  }
  if (!body) return refuse(f, fallback, "Write the note first.");
  if (id) {
    const [prev] = await db.select().from(deskNotes).where(eq(deskNotes.id, id));
    if (!prev) return refuse(f, fallback, "Note not found.");
    // Analysts edit their own notes; a super admin edits any.
    if (prev.userId !== me.id && !can(me, "delete")) return refuse(f, fallback, "You can edit your own notes. Add a new note instead.");
    await db.update(deskNotes).set({ body, editedAt: new Date() }).where(eq(deskNotes.id, id));
    await log(me, "Desk edited a note", prev.dealId, { entity: "note", entityId: id, officeId: prev.officeId, detail: { changes: changes(prev, { body }, ["body"]) } });
    return back(f, fallback, "Note saved.");
  }
  if (dealId && !(await dealRow(dealId))) return refuse(f, fallback, "Deal not found.");
  if (officeId) { const [o] = await db.select({ origin: offices.origin, addedById: offices.addedById }).from(offices).where(eq(offices.id, officeId)); if (!o || !canSeeOffice(me, o)) return refuse(f, fallback, "Investor not found."); }
  const [row] = await db.insert(deskNotes).values({ dealId, officeId, body, userId: me.id, who: me.name }).returning({ id: deskNotes.id });
  await log(me, "Desk added a note", dealId, { entity: "note", entityId: row.id, officeId, detail: { note: body.slice(0, 300) } });
  back(f, fallback, "Note added.");
}

// ---------------------------------------------------------------- desk files (internal; never shown to investors)
export async function saveDeskFile(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const dealId = n(f, "dealId"), id = n(f, "id");
  const d = await dealRow(dealId);
  if (!d) return refuse(f, "/admin/board", "Deal not found.");
  const fallback = `${dealPage(d)}#files`;
  if (f.get("delete") === "on") {
    if (!can(me, "delete")) return refuse(f, fallback, "Only a super admin can delete a file.");
    const [prev] = await db.select().from(deskFiles).where(and(eq(deskFiles.id, id), eq(deskFiles.dealId, dealId)));
    if (!prev) return refuse(f, fallback, "File not found.");
    await db.delete(deskFiles).where(eq(deskFiles.id, id));
    await log(me, `Desk deleted the file "${prev.title}" from ${d.company}`, dealId, { entity: "file", entityId: id, detail: { changes: { title: [prev.title, null], url: [prev.url, null] } } });
    return back(f, fallback, "File deleted.");
  }
  const title = s(f, "title", 300), link = s(f, "url", 2000);
  if (!title) return refuse(f, fallback, "Give the file a title.");
  if (link && !url(link)) return refuse(f, fallback, "Links start with https:// (a Google Drive or other secure link).");
  const vals = { title, url: url(link), kind: s(f, "kind", 80) || null, note: s(f, "note", 2000) || null };
  if (id) {
    const [prev] = await db.select().from(deskFiles).where(and(eq(deskFiles.id, id), eq(deskFiles.dealId, dealId)));
    if (!prev) return refuse(f, fallback, "File not found.");
    await db.update(deskFiles).set(vals).where(eq(deskFiles.id, id));
    await log(me, `Desk edited the file "${title}" on ${d.company}`, dealId, { entity: "file", entityId: id, detail: { changes: changes(prev, vals) } });
    return back(f, fallback, "File saved.");
  }
  const [row] = await db.insert(deskFiles).values({ ...vals, dealId, userId: me.id, who: me.name }).returning({ id: deskFiles.id });
  await log(me, `Desk added the file "${title}" to ${d.company}`, dealId, { entity: "file", entityId: row.id, detail: { changes: changes(null, vals) } });
  back(f, fallback, "File added. It stays on the desk; investors never see desk files.");
}

// ---------------------------------------------------------------- tasks and reminders
export async function saveTask(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const id = n(f, "id");
  const fallback = "/admin/tasks";
  const members = await deskMembers();
  if (f.get("delete") === "on") {
    if (!can(me, "delete")) return refuse(f, fallback, "Only a super admin can delete a task. Mark it done instead.");
    const [prev] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!prev) return refuse(f, fallback, "Task not found.");
    await db.delete(tasks).where(eq(tasks.id, id));
    await log(me, `Desk deleted the task "${prev.title}"`, prev.dealId, { entity: "task", entityId: id, officeId: prev.officeId, detail: { changes: { title: [prev.title, null] } } });
    return back(f, fallback, "Task deleted.");
  }
  const title = s(f, "title", 300);
  if (!title) return refuse(f, fallback, "Say what needs doing.");
  const assigneeId = n(f, "assigneeId") || me.id;
  if (!members.some((m) => m.id === assigneeId)) return refuse(f, fallback, "Tasks go to a desk member.");
  const dealId = n(f, "dealId") || null, officeId = n(f, "officeId") || null;
  if (dealId && !(await dealRow(dealId))) return refuse(f, fallback, "Deal not found.");
  if (officeId) {
    const [o] = await db.select({ origin: offices.origin, addedById: offices.addedById }).from(offices).where(eq(offices.id, officeId));
    if (!o || !canSeeOffice(me, o)) return refuse(f, fallback, "Investor not found.");
    // An investor added privately stays private: its tasks go only to someone who can see it.
    const to = members.find((m) => m.id === assigneeId);
    if (!to || !canSeeOffice(to, o)) return refuse(f, fallback, "Only the person who added this investor (or the super admin) can take tasks about it.");
  }
  const vals = { title, notes: s(f, "notes", 4000) || null, dealId, officeId, assigneeId, dueOn: day(s(f, "dueOn", 10)) };
  const who = (uid: number | null) => members.find((m) => m.id === uid)?.name ?? (uid ? `#${uid}` : "—");
  if (id) {
    const [prev] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!prev) return refuse(f, fallback, "Task not found.");
    await db.update(tasks).set({ ...vals, remindedOn: prev.dueOn !== vals.dueOn ? null : prev.remindedOn }).where(eq(tasks.id, id));
    const diff = changes(prev, vals, ["title", "notes", "dealId", "officeId", "dueOn"]);
    if (prev.assigneeId !== assigneeId) diff.assignee = [who(prev.assigneeId), who(assigneeId)];
    await log(me, `Desk edited the task "${title}"`, dealId, { entity: "task", entityId: id, officeId, detail: { changes: diff } });
    return back(f, fallback, "Task saved.");
  }
  const [row] = await db.insert(tasks).values({ ...vals, createdById: me.id, createdBy: me.name }).returning({ id: tasks.id });
  await log(me, `Desk added the task "${title}" for ${who(assigneeId)}${vals.dueOn ? `, due ${vals.dueOn}` : ""}`, dealId, { entity: "task", entityId: row.id, officeId,
    detail: { changes: { ...changes(null, vals, ["title", "dueOn", "dealId", "officeId"]), assignee: [null, who(assigneeId)] } } });
  back(f, fallback, assigneeId === me.id ? "Task added for you." : `Task added for ${who(assigneeId)}.${vals.dueOn ? " They get a reminder at 9 AM on the day it is due." : ""}`);
}

/** Done or reopened, by anyone on the desk. */
export async function setTaskDone(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const id = n(f, "id"), done = f.get("done") === "1";
  const [prev] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!prev) return refuse(f, "/admin/tasks", "Task not found.");
  if ((prev.status === "done") === done) return refuse(f, "/admin/tasks", "No change.");
  await db.update(tasks).set(done ? { status: "done", doneAt: new Date(), doneBy: me.name } : { status: "open", doneAt: null, doneBy: null, remindedOn: null }).where(eq(tasks.id, id));
  await log(me, `Desk ${done ? "finished" : "reopened"} the task "${prev.title}"`, prev.dealId, { entity: "task", entityId: id, officeId: prev.officeId,
    detail: { changes: { status: [prev.status, done ? "done" : "open"] } } });
  back(f, "/admin/tasks", done ? "Done." : "Reopened.");
}

// ---------------------------------------------------------------- After the Bell: listed-company deals
const LISTED_KEYS: (keyof ListedInfo)[] = ["exchange", "ticker", "isin", "sector", "dealType", "side", "price", "marketCap", "counterparty", "source"];
function listedFrom(f: FormData): ListedInfo {
  const o: ListedInfo = {};
  for (const k of LISTED_KEYS) { const v = s(f, k, 200); if (v) (o as Record<string, unknown>)[k] = k === "ticker" ? v.toUpperCase() : v; }
  const size = parseFloat(s(f, "sizeCr", 20).replace(/[₹,\s]/g, ""));
  o.sizeCr = isFinite(size) && size > 0 ? size : null;
  return o;
}

export async function createListedDeal(f: FormData) {
  const me = await requirePerm("deals.edit");
  const company = s(f, "company", 200);
  if (!company) return refuse(f, "/admin/after-the-bell", "Give the company's name.");
  const info = listedFrom(f);
  const db = await getDb();
  // A unique, meaningless slug: listed deals have no public page, so nothing should be guessable from it.
  const slug = `atb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const [row] = await db.insert(deals).values({
    slug, company, title: info.sector || "Listed company", category: info.dealType || "Listed company",
    headline: s(f, "summary", 600), listingLabel: [info.exchange, info.ticker].filter(Boolean).join(": ") || "Listed",
    phase: "preparing", listed: true, listedInfo: info, sort: 500,
    pipelineStage: asStage(s(f, "stage", 20)) ?? "sourced", stageAt: new Date(), ownerId: n(f, "ownerId") || me.id,
    room: { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [], interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] },
  }).returning({ id: deals.id });
  await log(me, `Desk added the listed company ${company} (After the Bell)`, row.id, { entity: "deal", entityId: row.id, detail: { changes: changes(null, { company, ...info } as Record<string, unknown>) } });
  redirect(resultUrl(`/admin/after-the-bell/${row.id}`, "Added to After the Bell. It is desk-only and never appears on the site."));
}

export async function saveListedDeal(f: FormData) {
  const me = await requirePerm("deals.edit");
  const d = await dealRow(n(f, "id"));
  if (!d || !d.listed) return refuse(f, "/admin/after-the-bell", "Not a listed-company deal.");
  const info = listedFrom(f);
  const vals = { company: s(f, "company", 200) || d.company, headline: s(f, "summary", 2000), status: s(f, "status", 200) || d.status,
    title: info.sector || "Listed company", category: info.dealType || "Listed company", listingLabel: [info.exchange, info.ticker].filter(Boolean).join(": ") || "Listed" };
  const db = await getDb();
  // published / open / preview are never set here; the database refuses them for a listed deal anyway.
  await db.update(deals).set({ ...vals, listedInfo: info, updatedAt: new Date() }).where(eq(deals.id, d.id));
  const diff = { ...changes(d, vals, ["company", "headline", "status"]), ...changes((d.listedInfo || {}) as Record<string, unknown>, info as Record<string, unknown>) };
  await log(me, `Desk updated the listed company ${vals.company}`, d.id, { entity: "deal", entityId: d.id, detail: { changes: diff } });
  back(f, `/admin/after-the-bell/${d.id}`, "Saved.");
}

// ---------------------------------------------------------------- investors the desk adds itself
type NewInvestor = { name: string; type: string; contactName: string; email: string; phone: string; city: string; ticket: string; website: string; notes: string };

/** Adds investors as already-approved offices tagged "added by desk". No user account is made and no email goes out. */
async function addInvestors(me: { id: number; name: string; role: string; officeId: number | null }, list: NewInvestor[]) {
  const db = await getDb();
  const emails = list.map((r) => r.email).filter(Boolean);
  const [taken, known, names] = await Promise.all([
    emails.length ? db.select({ email: users.email }).from(users).where(inArray(users.email, emails)) : Promise.resolve([]),
    // Duplicates are checked only against investors this person can see, so a private list never reveals another's.
    emails.length ? db.select({ email: offices.contactEmail }).from(offices).where(and(inArray(offices.contactEmail, emails), officeScope(me))) : Promise.resolve([]),
    db.select({ name: offices.name }).from(offices).where(officeScope(me)),
  ]);
  const seenEmail = new Set([...taken.map((r) => r.email), ...known.map((r) => r.email)].filter(Boolean).map((e) => e!.toLowerCase()));
  const seenName = new Set(names.map((r) => r.name.toLowerCase().trim()));
  const added: string[] = [], skipped: string[] = [];
  for (const r of list) {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ? r.email.toLowerCase() : "";
    if (email && seenEmail.has(email)) { skipped.push(`${r.name} (${email} is already on the desk)`); continue; }
    if (!email && seenName.has(r.name.toLowerCase().trim())) { skipped.push(`${r.name} (an office with this name exists)`); continue; }
    const [row] = await db.insert(offices).values({
      name: r.name.slice(0, 200), investorType: investorType(r.type), origin: "desk", approval: "approved", approvedAt: new Date(), status: "registered",
      contactName: r.contactName.slice(0, 160) || null, contactEmail: email || null, contactPhone: r.phone.slice(0, 40) || null,
      city: r.city.slice(0, 120) || null, ticket: r.ticket.slice(0, 80) || null, website: r.website.slice(0, 300) || null, notes: r.notes.slice(0, 4000) || null,
      addedBy: me.name, addedById: me.id, source: { s: "desk", m: "added by hand" },
    }).returning({ id: offices.id });
    await log(me, `Desk added the investor ${r.name} (no registration link sent)`, null, { entity: "investor", entityId: row.id, officeId: row.id,
      detail: { changes: changes(null, { name: r.name, contactName: r.contactName, email, phone: r.phone, city: r.city }) } });
    if (email) seenEmail.add(email);
    seenName.add(r.name.toLowerCase().trim());
    added.push(r.name);
  }
  return { added, skipped };
}

export async function addInvestor(f: FormData) {
  const me = await requirePerm("investors.add");
  const r: NewInvestor = { name: s(f, "name", 200), type: s(f, "type", 40), contactName: s(f, "contactName", 160), email: s(f, "email", 200).toLowerCase(),
    phone: s(f, "phone", 40), city: s(f, "city", 120), ticket: s(f, "ticket", 80), website: s(f, "website", 300), notes: s(f, "notes", 4000) };
  if (!r.name) return back(f, "/admin/offices?show=desk#add", "Give the investor's name.");
  const { added, skipped } = await addInvestors(me, [r]);
  revalidatePath("/admin/offices");
  back(f, "/admin/offices?show=desk", added.length ? `${r.name} is added (tagged "Added by desk"). No email went to them.` : `Not added: ${skipped[0]}.`);
}

export async function importInvestors(f: FormData) {
  const me = await requirePerm("investors.add");
  const file = f.get("file");
  let text = s(f, "csv", 400_000);
  if (file && typeof file === "object" && "text" in file && (file as File).size) {
    if ((file as File).size > 2_000_000) return back(f, "/admin/offices?show=desk#add", "Keep the file under 2 MB.");
    text = await (file as File).text();
  }
  if (!text.trim()) return back(f, "/admin/offices?show=desk#add", "Choose a CSV file or paste the rows.");
  const { rows, missing } = investorRows(text);
  if (missing.length) return back(f, "/admin/offices?show=desk#add", "The first row must name the columns, with at least a Name column.");
  if (!rows.length) return back(f, "/admin/offices?show=desk#add", "No rows with a name were found.");
  if (rows.length > 1000) return back(f, "/admin/offices?show=desk#add", "Import up to 1,000 rows at a time.");
  const { added, skipped } = await addInvestors(me, rows);
  await log(me, `Desk imported ${added.length} investors from CSV${skipped.length ? `, skipped ${skipped.length}` : ""}`, null, { entity: "investor", detail: { note: skipped.slice(0, 20).join("; ") || undefined } });
  revalidatePath("/admin/offices");
  back(f, "/admin/offices?show=desk", `Added ${added.length} ${added.length === 1 ? "investor" : "investors"} (tagged "Added by desk"; no emails sent).${skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 5).join("; ")}${skipped.length > 5 ? "…" : ""}` : ""}`);
}

/** The desk's contact details on an investor it added (analysts edit these too). */
export async function saveInvestorContact(f: FormData) {
  const me = await requirePerm("offices.notes");
  const db = await getDb();
  const id = n(f, "id");
  const [o] = await db.select().from(offices).where(eq(offices.id, id));
  if (!o || !canSeeOffice(me, o)) return refuse(f, "/admin/offices", "Investor not found.");
  const vals = { contactName: s(f, "contactName", 160) || null, contactEmail: s(f, "contactEmail", 200).toLowerCase() || null, contactPhone: s(f, "contactPhone", 40) || null };
  await db.update(offices).set(vals).where(eq(offices.id, id));
  await log(me, `Desk updated the contact for ${o.name}`, null, { entity: "office", entityId: id, officeId: id, detail: { changes: changes(o, vals) } });
  back(f, "/admin/offices?show=desk", "Contact saved.");
}

// ---------------------------------------------------------------- quick actions from the phone and from emails
/** Push a task's due date out by a few days (from the task page or the phone). */
export async function snoozeTask(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const id = n(f, "id"), days = Math.min(30, Math.max(1, n(f, "days") || 1));
  const [prev] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!prev) return refuse(f, "/desk/tasks", "Task not found.");
  const ist = new Date(Date.now() + 5.5 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);
  await db.update(tasks).set({ dueOn: ist, remindedOn: null }).where(eq(tasks.id, id));
  await log(me, `Desk moved the task "${prev.title}" to ${ist}`, prev.dealId, { entity: "task", entityId: id, officeId: prev.officeId, detail: { changes: { dueOn: [prev.dueOn, ist] } } });
  back(f, "/desk/tasks", `Moved to ${ist}.`);
}

/** One line after a call: kept as a desk note on the deal or investor, with an optional follow-up task for whoever logged it. */
export async function logCall(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const dealId = n(f, "dealId") || null, officeId = n(f, "officeId") || null;
  const fallback = dealId ? `/desk/deals/${dealId}` : officeId ? `/desk/investors/${officeId}` : "/desk";
  const what = s(f, "outcome", 2000), next = s(f, "next", 200), due = day(s(f, "due", 10));
  if (!what) return refuse(f, fallback, "Say how the call went in a line.");
  if (officeId) { const [o] = await db.select().from(offices).where(eq(offices.id, officeId)); if (!o || !canSeeOffice(me, o)) return refuse(f, "/desk", "Not found."); }
  const [note] = await db.insert(deskNotes).values({ dealId, officeId, body: `Call: ${what}${next ? `\nNext: ${next}${due ? ` (by ${due})` : ""}` : ""}`, userId: me.id, who: me.name }).returning({ id: deskNotes.id });
  await log(me, "Desk logged a call", dealId, { entity: "note", entityId: note.id, officeId });
  if (next) {
    const [t] = await db.insert(tasks).values({ title: next, dealId, officeId, assigneeId: me.id, dueOn: due, createdById: me.id, createdBy: me.name, notes: `From a call: ${what}` }).returning({ id: tasks.id });
    await log(me, `Desk added the task "${next}"`, dealId, { entity: "task", entityId: t.id, officeId });
  }
  back(f, fallback, next ? "Call logged, follow-up added to your tasks." : "Call logged.");
}

/** The desk accepts a transfer document, or asks the office to redo it (the office is told why, under the bell and by email). */
export async function checkKycFile(f: FormData) {
  const me = await requirePerm("offices.approve");
  const db = await getDb();
  const id = n(f, "id"), status = s(f, "status", 20), note = s(f, "note", 400);
  const [k] = await db.select({ id: kycFiles.id, officeId: kycFiles.officeId, kind: kycFiles.kind }).from(kycFiles).where(eq(kycFiles.id, id));
  const fallback = k ? `/desk/investors/${k.officeId}` : "/desk";
  if (!k || !["accepted", "redo"].includes(status)) return refuse(f, fallback, "Not found.");
  const [o] = await db.select().from(offices).where(eq(offices.id, k.officeId));
  if (!o || !canSeeOffice(me, o)) return refuse(f, "/desk", "Not found.");
  if (status === "redo" && !note) return refuse(f, fallback, "Say what needs redoing, in a line the office will read.");
  await db.update(kycFiles).set({ status, deskNote: status === "redo" ? note : null, checkedBy: me.name, checkedAt: new Date() }).where(eq(kycFiles.id, id));
  const { KYC_KINDS, isKycKind } = await import("@/lib/transfer");
  const label = isKycKind(k.kind) ? KYC_KINDS[k.kind].label : k.kind;
  await log(me, `Desk ${status === "accepted" ? "accepted" : "asked to redo"} the ${label.toLowerCase()}`, null, { entity: "office", entityId: o.id, officeId: o.id, detail: status === "redo" ? { note } : null });
  if (status === "redo") {
    const { notifyOffices } = await import("@/lib/notify");
    await notifyOffices([o.id], { title: `Please upload your ${label.toLowerCase()} again`, body: note, link: "/dashboard#Transfer" }).catch(() => {});
  }
  revalidatePath(fallback);
  back(f, fallback, status === "accepted" ? `${label} accepted.` : "The office has been asked to redo it.");
}

