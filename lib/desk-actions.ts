"use server";
// Desk workflow actions: deal stages and owners, desk notes, desk files, tasks, listed-company deals (After the Bell)
// and investors the desk adds by hand. Every rule is checked here on the server (lib/perm.ts); the admin UI only
// hides what a role cannot do. Every change is written to the audit trail with the fields that changed.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, deskFiles, deskNotes, offices, tasks, users, type ListedInfo } from "@/db/schema";
import { requirePerm, log, changes } from "@/lib/auth";
import { can } from "@/lib/perm";
import { asStage, stageLabel } from "@/lib/stages";
import { investorRows, investorType } from "@/lib/csv";
import { deskMembers, canSeeOffice, officeScope } from "@/lib/desk";

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const n = (f: FormData, k: string) => Number(f.get(k)) || 0;
/** Back to a desk page (only same-site admin paths), with a message. */
const back = (f: FormData | null, fallback: string, msg: string): never => {
  const want = f ? s(f, "back", 500) : "";
  const path = /^\/admin(\/|$|\?)/.test(want) ? want : fallback;
  const [p, hash] = path.split("#");
  redirect(`${p}${p.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
};
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
  if (!d || !stage) return back(f, "/admin/board", "Pick a stage.");
  if (d.pipelineStage === stage) return back(f, dealPage(d), "No change.");
  const db = await getDb();
  await db.update(deals).set({ pipelineStage: stage, stageAt: new Date() }).where(eq(deals.id, d.id));
  await log(me, `Desk moved ${d.company} to ${stageLabel(stage)}`, d.id, { entity: "deal", entityId: d.id, detail: { changes: { pipelineStage: [stageLabel(d.pipelineStage), stageLabel(stage)] } } });
  back(f, dealPage(d), `${d.company} is at ${stageLabel(stage)}. Nothing on the site changes with the stage.`);
}

export async function setDealOwner(f: FormData) {
  const me = await requirePerm("workflow");
  const d = await dealRow(n(f, "id"));
  if (!d) return back(f, "/admin/board", "Deal not found.");
  const ownerId = n(f, "ownerId") || null;
  const members = await deskMembers();
  if (ownerId && !members.some((m) => m.id === ownerId)) return back(f, dealPage(d), "Owners are desk members.");
  if (ownerId === d.ownerId) return back(f, dealPage(d), "No change.");
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
    if (!can(me, "delete")) return back(f, fallback, "Only a super admin can delete a note.");
    const [prev] = await db.select().from(deskNotes).where(eq(deskNotes.id, id));
    if (!prev) return back(f, fallback, "Note not found.");
    await db.delete(deskNotes).where(eq(deskNotes.id, id));
    await log(me, "Desk deleted a note", prev.dealId, { entity: "note", entityId: id, officeId: prev.officeId, detail: { changes: { body: [prev.body, null] } } });
    return back(f, fallback, "Note deleted.");
  }
  if (!body) return back(f, fallback, "Write the note first.");
  if (id) {
    const [prev] = await db.select().from(deskNotes).where(eq(deskNotes.id, id));
    if (!prev) return back(f, fallback, "Note not found.");
    // Analysts edit their own notes; a super admin edits any.
    if (prev.userId !== me.id && !can(me, "delete")) return back(f, fallback, "You can edit your own notes. Add a new note instead.");
    await db.update(deskNotes).set({ body, editedAt: new Date() }).where(eq(deskNotes.id, id));
    await log(me, "Desk edited a note", prev.dealId, { entity: "note", entityId: id, officeId: prev.officeId, detail: { changes: changes(prev, { body }, ["body"]) } });
    return back(f, fallback, "Note saved.");
  }
  if (dealId && !(await dealRow(dealId))) return back(f, fallback, "Deal not found.");
  if (officeId) { const [o] = await db.select({ origin: offices.origin, addedById: offices.addedById }).from(offices).where(eq(offices.id, officeId)); if (!o || !canSeeOffice(me, o)) return back(f, fallback, "Investor not found."); }
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
  if (!d) return back(f, "/admin/board", "Deal not found.");
  const fallback = `${dealPage(d)}#files`;
  if (f.get("delete") === "on") {
    if (!can(me, "delete")) return back(f, fallback, "Only a super admin can delete a file.");
    const [prev] = await db.select().from(deskFiles).where(and(eq(deskFiles.id, id), eq(deskFiles.dealId, dealId)));
    if (!prev) return back(f, fallback, "File not found.");
    await db.delete(deskFiles).where(eq(deskFiles.id, id));
    await log(me, `Desk deleted the file "${prev.title}" from ${d.company}`, dealId, { entity: "file", entityId: id, detail: { changes: { title: [prev.title, null], url: [prev.url, null] } } });
    return back(f, fallback, "File deleted.");
  }
  const title = s(f, "title", 300), link = s(f, "url", 2000);
  if (!title) return back(f, fallback, "Give the file a title.");
  if (link && !url(link)) return back(f, fallback, "Links start with https:// (a Google Drive or other secure link).");
  const vals = { title, url: url(link), kind: s(f, "kind", 80) || null, note: s(f, "note", 2000) || null };
  if (id) {
    const [prev] = await db.select().from(deskFiles).where(and(eq(deskFiles.id, id), eq(deskFiles.dealId, dealId)));
    if (!prev) return back(f, fallback, "File not found.");
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
    if (!can(me, "delete")) return back(f, fallback, "Only a super admin can delete a task. Mark it done instead.");
    const [prev] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!prev) return back(f, fallback, "Task not found.");
    await db.delete(tasks).where(eq(tasks.id, id));
    await log(me, `Desk deleted the task "${prev.title}"`, prev.dealId, { entity: "task", entityId: id, officeId: prev.officeId, detail: { changes: { title: [prev.title, null] } } });
    return back(f, fallback, "Task deleted.");
  }
  const title = s(f, "title", 300);
  if (!title) return back(f, fallback, "Say what needs doing.");
  const assigneeId = n(f, "assigneeId") || me.id;
  if (!members.some((m) => m.id === assigneeId)) return back(f, fallback, "Tasks go to a desk member.");
  const dealId = n(f, "dealId") || null, officeId = n(f, "officeId") || null;
  if (dealId && !(await dealRow(dealId))) return back(f, fallback, "Deal not found.");
  if (officeId) {
    const [o] = await db.select({ origin: offices.origin, addedById: offices.addedById }).from(offices).where(eq(offices.id, officeId));
    if (!o || !canSeeOffice(me, o)) return back(f, fallback, "Investor not found.");
    // An investor added privately stays private: its tasks go only to someone who can see it.
    const to = members.find((m) => m.id === assigneeId);
    if (!to || !canSeeOffice(to, o)) return back(f, fallback, "Only the person who added this investor (or the super admin) can take tasks about it.");
  }
  const vals = { title, notes: s(f, "notes", 4000) || null, dealId, officeId, assigneeId, dueOn: day(s(f, "dueOn", 10)) };
  const who = (uid: number | null) => members.find((m) => m.id === uid)?.name ?? (uid ? `#${uid}` : "—");
  if (id) {
    const [prev] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!prev) return back(f, fallback, "Task not found.");
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
  if (!prev) return back(f, "/admin/tasks", "Task not found.");
  if ((prev.status === "done") === done) return back(f, "/admin/tasks", "No change.");
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
  if (!company) return back(f, "/admin/after-the-bell", "Give the company's name.");
  const info = listedFrom(f);
  const db = await getDb();
  // A unique, meaningless slug: listed deals have no public page, so nothing should be guessable from it.
  const slug = `atb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const [row] = await db.insert(deals).values({
    slug, company, title: info.sector || "Listed company", category: info.dealType || "Listed company", stage: "Desk only", status: "After the Bell · desk only",
    headline: s(f, "summary", 600), listingLabel: [info.exchange, info.ticker].filter(Boolean).join(": ") || "Listed",
    open: false, published: false, preview: false, listed: true, listedInfo: info, sort: 500,
    pipelineStage: asStage(s(f, "stage", 20)) ?? "sourced", stageAt: new Date(), ownerId: n(f, "ownerId") || me.id,
    room: { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [], interest: { min: 0, max: 0, step: 0, def: 0, note: "" }, alerts: [], passReasons: [] },
  }).returning({ id: deals.id });
  await log(me, `Desk added the listed company ${company} (After the Bell)`, row.id, { entity: "deal", entityId: row.id, detail: { changes: changes(null, { company, ...info } as Record<string, unknown>) } });
  redirect(`/admin/after-the-bell/${row.id}?msg=${encodeURIComponent("Added to After the Bell. It is desk-only and never appears on the site.")}`);
}

export async function saveListedDeal(f: FormData) {
  const me = await requirePerm("deals.edit");
  const d = await dealRow(n(f, "id"));
  if (!d || !d.listed) return back(f, "/admin/after-the-bell", "Not a listed-company deal.");
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
  if (!o || !canSeeOffice(me, o)) return back(f, "/admin/offices", "Investor not found.");
  const vals = { contactName: s(f, "contactName", 160) || null, contactEmail: s(f, "contactEmail", 200).toLowerCase() || null, contactPhone: s(f, "contactPhone", 40) || null };
  await db.update(offices).set(vals).where(eq(offices.id, id));
  await log(me, `Desk updated the contact for ${o.name}`, null, { entity: "office", entityId: id, officeId: id, detail: { changes: changes(o, vals) } });
  back(f, "/admin/offices?show=desk", "Contact saved.");
}
