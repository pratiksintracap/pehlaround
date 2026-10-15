"use server";
import { DEFAULT_PROMISES } from "@/lib/promises";
import { track } from "@/lib/track";
import { startSeries, backfill, preview } from "@/lib/onboarding";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_TAG } from "@/lib/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { articles, broadcasts, dealLinks, deskInvites, calls, deals, documents, interests, leads, ndas, notifications, offices, questions, users } from "@/db/schema";
import { notifyOffices, notifyDesk, ndaOffices, sendEmail, emailReady, ALERT_TOPICS } from "@/lib/notify";
import { sendRaw } from "@/lib/email";
import { inviteEmail } from "@/lib/invite-mail";
import { randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/site";
import { saveSettings } from "@/lib/settings";
import { requireAdmin, requireDesk, requirePerm, log, signOutEverywhere } from "@/lib/auth";
import { can, isDesk, isSuper, ROLE_LABEL, type DeskRole } from "@/lib/perm";
import { fromText } from "@/lib/pipes";
import type { RoomContent, IpoProgress } from "@/lib/types";
import ART from "@/lib/deal-art.json";

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const n = (f: FormData, k: string) => Number(f.get(k));
const back = (path: string, msg: string) => {
  revalidateTag(PUBLIC_TAG); // every desk change refreshes the public cache
  const [p, hash] = path.split("#");
  redirect(`${p}${p.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
};

function json<T>(raw: string, label: string): T | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { throw new Error(`${label} is not valid JSON`); }
}

// ---------------------------------------------------------------- offices
export async function setOfficeStatus(f: FormData) {
  const admin = await requireAdmin();
  const id = n(f, "id"), status = s(f, "status");
  if (!["registered", "pan_submitted", "verified", "rejected"].includes(status)) return;
  const db = await getDb();
  await db.update(offices).set({ status, verifiedAt: status === "verified" ? new Date() : null }).where(eq(offices.id, id));
  await log(admin, `Desk set office #${id} to ${status}`);
  revalidatePath("/admin/offices");
  back("/admin/offices", "Office updated.");
}

export async function setApproval(f: FormData) {
  const admin = await requirePerm("offices.approve");
  const id = n(f, "id"), approval = s(f, "approval");
  if (!["approved", "pending", "rejected"].includes(approval)) return;
  const db = await getDb();
  const [o] = await db.select().from(offices).where(eq(offices.id, id));
  if (!o) return;
  await db.update(offices).set({ approval, approvedAt: approval === "approved" ? new Date() : null }).where(eq(offices.id, id));
  await log(admin, `Desk set ${o.name} to ${approval}`);
  if (approval === "approved" && o.approval !== "approved") {
    await track("office_approved", { officeId: id, userId: admin.id, source: o.source ?? null });
    // In-app notice only: the "You're in" email of the onboarding series does the emailing.
    // Back to the deal they registered from, if there was one.
    const [withIntent] = await db.select({ intent: users.intent }).from(users).where(and(eq(users.officeId, id), sql`${users.intent} is not null`)).limit(1);
    const [want] = withIntent?.intent ? await db.select({ company: deals.company, slug: deals.slug }).from(deals).where(eq(deals.slug, withIntent.intent)) : [];
    await notifyOffices([id], { title: "Your office is approved", body: want ? `${want.company} is open to you now: sign its NDA on screen and its room opens.` : "Every company on Before the Bell is now open to you by name. Sign a company's NDA on screen to open its deal room.", link: want ? `/deals/${want.slug}#sign` : "/deals" }, false);
    const team = await db.select({ id: users.id }).from(users).where(and(eq(users.officeId, id), eq(users.disabled, false)));
    for (const t of team) await startSeries(t.id, "approved").catch(() => 0);
  }
  if (approval === "rejected" && o.approval !== "rejected" && f.get("tell") === "on")
    await notifyOffices([id], { title: "Your access is on hold", body: s(f, "reason", 1000) || "Please write to the desk and we will help.", link: "/dashboard" });
  revalidatePath("/admin/offices");
  back(s(f, "back") || "/admin/offices", approval === "approved" ? `${o.name} approved and told.` : "Office updated.");
}

export async function saveOfficeNotes(f: FormData) {
  await requirePerm("offices.notes");
  const db = await getDb();
  await db.update(offices).set({ notes: s(f, "notes", 2000) || null }).where(eq(offices.id, n(f, "id")));
  back("/admin/offices", "Notes saved.");
}

export async function resetPassword(f: FormData) {
  const admin = await requireAdmin();
  const pw = s(f, "password", 200);
  if (pw.length < 8) back("/admin/offices", "Password must be at least 8 characters.");
  const db = await getDb();
  await db.update(users).set({ passwordHash: await bcrypt.hash(pw, 10) }).where(eq(users.id, n(f, "id")));
  await signOutEverywhere(n(f, "id"));
  await log(admin, `Desk reset the password for user #${n(f, "id")}`);
  back("/admin/offices", "Password reset. Share it with the user privately.");
}

export async function toggleUser(f: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = n(f, "id");
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (u && !isDesk(u)) { await db.update(users).set({ disabled: !u.disabled }).where(eq(users.id, id)); await signOutEverywhere(id); }
  back("/admin/offices", "User updated.");
}

export async function revokeNda(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  await db.update(ndas).set({ revokedAt: new Date() }).where(eq(ndas.id, n(f, "id")));
  await log(admin, `Desk revoked NDA #${n(f, "id")}`);
  back("/admin/offices", "NDA access revoked.");
}

// ---------------------------------------------------------------- desk team (super admin only)
const asRole = (v: string): DeskRole => (v === "admin" ? "admin" : "analyst");
async function superCount() {
  const db = await getDb();
  return (await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.disabled, false)))).length;
}

export async function addDeskMember(f: FormData) {
  const admin = await requireAdmin();
  const email = s(f, "email", 200).toLowerCase(), name = s(f, "name", 120), pw = s(f, "password", 200), role = asRole(s(f, "role", 20));
  if (!email || !name) back("/admin/team", "Name and email are needed.");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (u?.officeId) back("/admin/team", `${email} belongs to a family office. Desk members need their own email.`);
  if (u) await db.update(users).set({ role, disabled: false, ...(pw.length >= 8 ? { passwordHash: await bcrypt.hash(pw, 10) } : {}) }).where(eq(users.id, u.id));
  else {
    if (pw.length < 8) back("/admin/team", "Set a temporary password of at least 8 characters for a new desk member.");
    await db.insert(users).values({ email, name, role, passwordHash: await bcrypt.hash(pw, 10) });
  }
  await log(admin, `Desk added ${email} as ${ROLE_LABEL[role]}`);
  back("/admin/team", `${name} is on the desk as ${ROLE_LABEL[role].toLowerCase()}.${!u ? " Share the temporary password with them privately." : ""}`);
}

export async function setDeskRole(f: FormData) {
  const admin = await requireAdmin();
  const id = n(f, "id"), role = asRole(s(f, "role", 20));
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || !isDesk(u)) back("/admin/team", "That person is not on the desk.");
  if (u.id === admin.id) back("/admin/team", "You cannot change your own role.");
  if (isSuper(u) && role !== "admin" && (await superCount()) <= 1) back("/admin/team", "The desk needs at least one super admin.");
  await db.update(users).set({ role }).where(eq(users.id, id));
  await signOutEverywhere(id);
  await log(admin, `Desk made ${u.email} ${ROLE_LABEL[role]}`);
  back("/admin/team", `${u.name} is now ${ROLE_LABEL[role].toLowerCase()}. They sign in again to pick it up.`);
}

export async function removeDeskMember(f: FormData) {
  const admin = await requireAdmin();
  const id = n(f, "id");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || !isDesk(u)) back("/admin/team", "That person is not on the desk.");
  if (u.id === admin.id) back("/admin/team", "You cannot remove yourself.");
  if (isSuper(u) && (await superCount()) <= 1) back("/admin/team", "The desk needs at least one super admin.");
  await db.update(users).set({ disabled: true }).where(eq(users.id, id));
  await signOutEverywhere(id);
  await log(admin, `Desk removed ${u.email} from the desk`);
  back("/admin/team", `${u.name} is removed and signed out everywhere.`);
}

// ---------------------------------------------------------------- deals
export async function saveDeal(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const pub = can(admin, "deals.publish"); // the whole desk may publish; the permission stays so a role can be narrowed later
  const id = n(f, "id");
  const db = await getDb();
  const [cur] = await db.select().from(deals).where(eq(deals.id, id));
  if (!cur) return;
  const path = `/admin/deals/${id}`;
  let room: RoomContent;
  try {
    room = {
      ...cur.room,
      lede: s(f, "lede"), why: s(f, "why"), founders: fromText.founders(s(f, "founders", 4000)), round: s(f, "round"), ticket: s(f, "ticket"), committed: s(f, "committed") || undefined,
      snapshot: fromText.cells(s(f, "snapshot", 8000)),
      risks: fromText.risks(s(f, "risks", 12000)),
      feed: fromText.feed(s(f, "feed", 8000)),
      fin: fromText.fin(s(f, "fin", 8000), s(f, "finUnit"), s(f, "finNote")),
      pe: fromText.pe(s(f, "pe", 4000)),
      multiples: fromText.cells(s(f, "multiples", 6000)),
      peers: s(f, "peers") || undefined,
      terms: fromText.terms(s(f, "terms", 12000)),
      path: fromText.path(s(f, "path", 6000)),
      checks: fromText.checks(s(f, "checks", 12000)),
      mine: fromText.list(s(f, "mine")),
      alerts: fromText.list(s(f, "alerts")),
      passReasons: fromText.list(s(f, "passReasons")),
      highlight: json(s(f, "highlight", 4000), "Highlight"),
      stake: json(s(f, "stake", 1000), "Stake"),
      interest: json(s(f, "interest", 2000), "Interest") ?? cur.room.interest,
      scenario: json(s(f, "scenario", 2000), "Scenario"),
    };
  } catch (e) {
    back(path, (e as Error).message);
    return;
  }
  const artKey = s(f, "artKey");
  const day = (k: string) => { const v = s(f, k, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined; };
  const rs = (k: string) => { const v = parseFloat(s(f, k, 20).replace(/[₹,\s]/g, "")); return isFinite(v) && v > 0 ? v : undefined; };
  const ipo: IpoProgress = { closed: day("ipo_closed"), drhp: day("ipo_drhp"), sebi: day("ipo_sebi"), rhp: day("ipo_rhp"), priceBand: s(f, "ipo_priceBand", 60) || undefined,
    listing: day("ipo_listing"), listPrice: rs("ipo_listPrice"), lastPrice: rs("ipo_lastPrice"), lastAt: day("ipo_lastAt"), note: s(f, "ipo_note", 300) || undefined };
  await db.update(deals).set({
    company: s(f, "company", 200), title: s(f, "title", 200), category: s(f, "category", 80), stage: s(f, "stage", 80), status: s(f, "status", 200),
    headline: s(f, "headline", 600), listingLabel: s(f, "listingLabel", 80), listingMonth: s(f, "listingMonth", 7) || null, listingNote: s(f, "listingNote", 200) || null,
    score: (() => { const v = parseFloat(s(f, "score", 10)); return isFinite(v) ? Math.round(Math.min(10, Math.max(0, v)) * 10) / 10 : null; })(),
    roundLabel: s(f, "roundLabel", 80) || null, preMoney: s(f, "preMoney", 80) || null, peLabel: s(f, "peLabel", 80) || null, minTicket: s(f, "minTicket", 80) || null,
    open: pub ? f.get("open") === "on" : cur.open, published: pub ? f.get("published") === "on" : cur.published, sort: n(f, "sort") || 100, asOf: s(f, "asOf", 40) || null,
    ndaVersion: s(f, "ndaVersion", 40) || cur.ndaVersion,
    publicRisks: fromText.list(s(f, "publicRisks", 6000)),
    roundCr: (() => { const v = parseFloat(s(f, "roundCr", 20).replace(/,/g, "")); return isFinite(v) && v > 0 ? v : null; })(),
    ipo, promoterDemand: f.get("promoterDemand") === "on",
    preview: pub ? f.get("preview") === "on" : cur.preview,
    dataRoomUrl: (() => { const v = s(f, "dataRoomUrl", 2000); return /^https:\/\//.test(v) ? v : null; })(),
    art: artKey && (ART as Record<string, string>)[artKey] ? (ART as Record<string, string>)[artKey] : cur.art,
    room, updatedAt: new Date(),
  }).where(eq(deals.id, id));
  await log(admin, `Desk updated the deal: ${s(f, "company", 200)}`, id);
  // A new step on the road to listing: tell the offices that hold shares.
  const STEP: [keyof IpoProgress, string][] = [["closed", "the round has closed"], ["drhp", "the draft offer document is filed"], ["sebi", "SEBI observations are in"], ["rhp", "the price band is out"], ["listing", "the listing date is set"]];
  const fresh = STEP.filter(([k]) => ipo[k] && !(cur.ipo || {})[k]);
  if (fresh.length) {
    const holders = [...new Set((await db.select({ o: interests.officeId }).from(interests).where(and(eq(interests.dealId, id), eq(interests.status, "Allotted")))).map((r) => r.o))];
    if (holders.length) await notifyOffices(holders, { title: `${s(f, "company", 200)}: ${fresh[fresh.length - 1][1]}`, body: ipo.note || null, link: "/dashboard#Portfolio" });
  }
  // Newly published: tell approved offices, if the desk ticked the box.
  if (pub && !cur.published && f.get("published") === "on" && f.get("announce") === "on") {
    const ids = (await db.select({ id: offices.id }).from(offices).where(eq(offices.approval, "approved"))).map((r) => r.id);
    await notifyOffices(ids, { title: `New on the desk: ${s(f, "company", 200)}`, body: `${s(f, "title", 200)} · ${s(f, "category", 80)}. ${s(f, "headline", 600)}`, link: `/deals/${cur.slug}` });
  }
  revalidatePath("/", "layout");
  back(path, "Saved. The site shows the change now.");
}

/** One-click from the deals list: take a live deal down (back to in preparation) or put it live again. No announcement is sent. */
export async function setDealPublished(f: FormData) {
  const admin = await requirePerm("deals.publish");
  const id = n(f, "id"), on = f.get("published") === "1";
  const db = await getDb();
  const [d] = await db.select({ company: deals.company }).from(deals).where(eq(deals.id, id));
  if (!d) return;
  await db.update(deals).set({ published: on, updatedAt: new Date() }).where(eq(deals.id, id));
  await log(admin, `Desk ${on ? "published" : "took down (in preparation)"} the deal: ${d.company}`, id);
  revalidatePath("/", "layout");
  back("/admin/deals", on ? `${d.company} is live again.` : `${d.company} is taken down: in preparation, the desk alone sees it.`);
}

export async function createDeal(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const slug = s(f, "slug", 80).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const company = s(f, "company", 200), title = s(f, "title", 200);
  if (!slug || !company || !title) back("/admin/deals", "Slug, company and public title are needed.");
  const db = await getDb();
  const [dup] = await db.select({ id: deals.id }).from(deals).where(eq(deals.slug, slug));
  if (dup) back("/admin/deals", "That slug is taken.");
  const room: RoomContent = { lede: "", why: "", round: "", ticket: "", snapshot: [], risks: [], feed: [], multiples: [], terms: [], path: [], checks: [], mine: [],
    interest: { min: 0.5, max: 10, step: 0.5, def: 1, note: "Non-binding indication. A commitment is made only on signed documents after KYC, with a summary of terms and the risks to confirm first." },
    alerts: ["A new document is added", "The promoter answers a question", "Terms or price change"], passReasons: ["Valuation too rich for us", "Sector outside our mandate", "Other"] };
  const [row] = await db.insert(deals).values({ slug, company, title, category: "Pre-IPO primary", stage: "Draft", status: "In diligence · not open", headline: "",
    listingLabel: "To be set", open: false, published: false, sort: 200, art: Object.values(ART as Record<string, string>)[0], room }).returning({ id: deals.id });
  await log(admin, `Desk created the deal: ${company}`, row.id);
  redirect(`/admin/deals/${row.id}?msg=${encodeURIComponent(can(admin, "deals.publish") ? "Created, in preparation: the desk alone sees it. Fill it in, then tick Published." : "Created, in preparation. Fill it in, then ask a super admin to publish it.")}`);
}

/** An analyst asks a super admin to publish (or open) a deal. */
export async function requestPublish(f: FormData) {
  const me = await requirePerm("deals.edit");
  const id = n(f, "id");
  const db = await getDb();
  const [d] = await db.select({ company: deals.company, published: deals.published, open: deals.open }).from(deals).where(eq(deals.id, id));
  if (!d) return;
  const what = !d.published ? "publish" : !d.open ? "open for allocation requests" : "review";
  const note = s(f, "note", 600);
  await notifyDesk({ title: `${me.name} asks you to ${what}: ${d.company}`, body: note || "Check the deal and tick Published (and Open) if it is ready.", link: `/admin/deals/${id}` });
  await log(me, `Desk asked a super admin to ${what} the deal: ${d.company}`, id);
  back(`/admin/deals/${id}`, "Sent to a super admin. You will see it go live when they publish it.");
}

// ---------------------------------------------------------------- documents
export async function saveDocument(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const dealId = n(f, "dealId"), id = n(f, "id");
  const db = await getDb();
  const audience = ["approved", "nda", "allocation", "offices"].includes(s(f, "audience", 20)) ? s(f, "audience", 20) : "nda";
  const officeIds = f.getAll("officeIds").map(Number).filter((x) => x > 0);
  const vals = { title: s(f, "title", 300), kind: s(f, "kind", 80) || null, status: s(f, "status", 20) || "available", url: s(f, "url", 2000) || null, sort: n(f, "sort") || 100, audience, officeIds };
  const [prev] = id ? await db.select().from(documents).where(eq(documents.id, id)) : [];
  if (f.get("delete") === "on" && id && !can(admin, "delete")) back(`/admin/deals/${dealId}#docs`, "Only a super admin can delete a document. Set it to Hidden instead.");
  if (f.get("delete") === "on" && id) await db.delete(documents).where(eq(documents.id, id));
  else if (id) await db.update(documents).set(vals).where(eq(documents.id, id));
  else if (vals.title) await db.insert(documents).values({ ...vals, dealId });
  const nowAvailable = f.get("delete") !== "on" && vals.title && vals.status === "available" && vals.url && (!prev || prev.status !== "available" || !prev.url);
  if (nowAvailable && f.get("tell") !== "off") {
    const [d] = await db.select({ company: deals.company, slug: deals.slug }).from(deals).where(eq(deals.id, dealId));
    let to = await ndaOffices(dealId);
    if (audience === "offices") to = to.filter((o) => officeIds.includes(o));
    if (audience === "allocation") {
      const asked = new Set((await db.select({ o: interests.officeId }).from(interests).where(eq(interests.dealId, dealId))).map((r) => r.o));
      to = to.filter((o) => asked.has(o));
    }
    if (audience === "approved") {
      // Layer 2: the pitch deck goes to every approved investor, not only the offices with this NDA, and only if the deal is published.
      const [pub] = await db.select({ published: deals.published }).from(deals).where(eq(deals.id, dealId));
      to = pub?.published ? (await db.select({ id: offices.id }).from(offices).where(eq(offices.approval, "approved"))).map((r) => r.id) : [];
      await notifyOffices(to, { title: `${d?.company}: ${vals.title} is on the desk`, body: "Read the company's own material, then sign its NDA for the data bank.", link: `/deals/${d?.slug}#deck` }, true, { dealId, topic: "document" });
    } else await notifyOffices(to, { title: `${d?.company}: new in the data room`, body: vals.title, link: `/room/${d?.slug}` }, true, { dealId, topic: "document" });
  }
  await log(admin, `Desk updated documents`, dealId);
  back(`/admin/deals/${dealId}#docs`, "Documents saved.");
}

// ---------------------------------------------------------------- Q&A, calls, interests, leads
export async function answerQuestion(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const id = n(f, "id"), answer = s(f, "answer", 4000);
  const db = await getDb();
  const [q] = await db.select().from(questions).where(eq(questions.id, id));
  if (!q) return;
  await db.update(questions).set({
    question: s(f, "question", 1000) || q.question, answer: answer || null, answeredBy: answer ? (s(f, "by", 80) || "Desk") : null,
    answeredAt: answer ? (q.answeredAt ?? new Date()) : null, hidden: f.get("hidden") === "on",
    ...(answer ? { draftAnswer: null, draftAt: null } : {}),
  }).where(eq(questions.id, id));
  await log(admin, `Desk ${answer ? "answered" : "updated"} a question`, q.dealId);
  if (answer && !q.answer && f.get("hidden") !== "on") {
    const [d] = await db.select({ company: deals.company, slug: deals.slug }).from(deals).where(eq(deals.id, q.dealId));
    // A private question is answered only to the office that asked it.
    const to = q.private ? [] : await ndaOffices(q.dealId);
    if (q.officeId) to.push(q.officeId);
    await notifyOffices(to, { title: `${d?.company}: ${q.private ? "your private question is answered" : "a question is answered"}`, body: q.question.slice(0, 280), link: `/room/${d?.slug}#Q%26A` }, true, { dealId: q.dealId, topic: "answer" });
  }
  back(s(f, "back") || "/admin/activity", "Question saved.");
}

export async function addQuestion(f: FormData) {
  await requirePerm("deals.edit");
  const db = await getDb();
  const q = s(f, "question", 1000), a = s(f, "answer", 4000);
  if (q) await db.insert(questions).values({ dealId: n(f, "dealId"), question: q, answer: a || null, answeredBy: a ? (s(f, "by", 80) || "Desk") : null, answeredAt: a ? new Date() : null });
  back(`/admin/deals/${n(f, "dealId")}#qa`, "Added to the room's Q&A.");
}

export async function saveCall(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const db = await getDb();
  const id = n(f, "id");
  const vals = { status: s(f, "status", 40) || "Requested", scheduledFor: s(f, "scheduledFor", 120) || null, summary: s(f, "summary", 4000) || null, title: s(f, "title", 200) || null };
  const [prev] = id ? await db.select().from(calls).where(eq(calls.id, id)) : [];
  if (id) await db.update(calls).set(vals).where(eq(calls.id, id));
  else await db.insert(calls).values({ ...vals, dealId: n(f, "dealId"), kind: "session" });
  const dealId = prev?.dealId ?? n(f, "dealId");
  const changed = !prev || prev.status !== vals.status || prev.scheduledFor !== vals.scheduledFor || (!!vals.summary && prev.summary !== vals.summary);
  if (changed && dealId && vals.status !== "Requested") {
    const [d] = await db.select({ company: deals.company, slug: deals.slug }).from(deals).where(eq(deals.id, dealId));
    const to = prev?.officeId ? [prev.officeId] : await ndaOffices(dealId);
    await notifyOffices(to, { title: `${d?.company}: ${vals.title || "promoter call"} · ${vals.status}${vals.scheduledFor ? ` · ${vals.scheduledFor}` : ""}`,
      body: vals.summary, link: `/room/${d?.slug}` }, true, prev?.officeId ? undefined : { dealId, topic: "session" });
  }
  await log(admin, "Desk updated a call");
  back(s(f, "back") || "/admin/activity", "Call saved.");
}

export async function saveInterest(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  const [prev] = await db.select().from(interests).where(eq(interests.id, n(f, "id")));
  if (!prev) return;
  const status = s(f, "status", 40) || prev.status;
  const num = (k: string) => { const v = parseFloat(s(f, k, 20).replace(/,/g, "")); return isFinite(v) && v > 0 ? v : null; };
  const shares = f.has("shares") ? (num("shares") !== null ? Math.round(num("shares") as number) : null) : prev.shares;
  const price = f.has("price") ? num("price") : prev.price;
  await db.update(interests).set({ status, note: f.has("note") ? s(f, "note", 1000) || null : prev.note, shares, price,
    allottedAt: status === "Allotted" ? (prev.allottedAt ?? new Date()) : prev.allottedAt }).where(eq(interests.id, prev.id));
  if (prev.status !== status) {
    const [d] = await db.select({ company: deals.company }).from(deals).where(eq(deals.id, prev.dealId));
    await notifyOffices([prev.officeId], { title: `${d?.company}: your allocation request is ${status.toLowerCase()}`, body: s(f, "note", 1000) || null, link: status === "Allotted" ? "/dashboard#Portfolio" : "/dashboard" });
  }
  await log(admin, `Desk set allocation #${prev.id} to ${status}${shares ? ` · ${shares.toLocaleString("en-IN")} shares` : ""}${price ? ` at ₹${price}` : ""}`, prev.dealId);
  back(s(f, "back") || "/admin/activity", "Allocation updated.");
}

export async function saveLead(f: FormData) {
  await requirePerm("leads");
  const db = await getDb();
  await db.update(leads).set({ status: s(f, "status", 40) }).where(eq(leads.id, n(f, "id")));
  back("/admin/activity#leads", "Lead updated.");
}

// ---------------------------------------------------------------- articles
export async function saveArticle(f: FormData) {
  const admin = await requirePerm("articles.edit");
  const db = await getDb();
  const id = n(f, "id");
  const pub = can(admin, "articles.publish");
  const [cur] = id ? await db.select({ published: articles.published }).from(articles).where(eq(articles.id, id)) : [];
  if (!pub && cur?.published) back(`/admin/articles/${id}`, "This article is live. Only a super admin can change it.");
  if (!pub && f.get("delete") === "on") back(`/admin/articles/${id}`, "Only a super admin can delete an article.");
  const slug = s(f, "slug", 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const title = s(f, "title", 300);
  if (!slug || !title) back(id ? `/admin/articles/${id}` : "/admin/articles/new", "A title and a web address slug are needed.");
  const sources = s(f, "sources", 4000).split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[1]?.startsWith("http")).map(([t, u]) => ({ title: t || u, url: u }));
  const when = s(f, "publishedAt", 40);
  const vals = { slug, title, dek: s(f, "dek", 600) || null, body: s(f, "body", 40000), sources, externalUrl: s(f, "externalUrl", 1000) || null, image: s(f, "image", 1000) || null,
    author: s(f, "author", 120) || "Before the Bell team", published: pub && f.get("published") === "on",
    publishedAt: when ? new Date(when + (when.length <= 10 ? "T09:00:00+05:30" : "")) : new Date(), updatedAt: new Date() };
  if (f.get("delete") === "on" && id) {
    await db.delete(articles).where(eq(articles.id, id));
    await log(admin, `Desk deleted the article: ${title}`);
    back("/admin/articles", "Article deleted.");
  }
  let rid = id;
  if (id) await db.update(articles).set(vals).where(eq(articles.id, id));
  else rid = (await db.insert(articles).values(vals).returning({ id: articles.id }))[0].id;
  await log(admin, `Desk saved the article: ${title}`);
  if (!pub && f.get("askPublish") === "on") await notifyDesk({ title: `${admin.name} asks you to publish an article: ${title}`, body: vals.dek, link: `/admin/articles/${rid}` });
  revalidatePath("/", "layout");
  back(`/admin/articles/${rid}`, pub ? "Saved." : f.get("askPublish") === "on" ? "Saved as a draft and sent to a super admin to publish." : "Saved as a draft.");
}

// ---------------------------------------------------------------- notifications and settings
export async function sendBroadcast(f: FormData) {
  const admin = await requireDesk();
  const title = s(f, "title", 200), body = s(f, "body", 4000), link = s(f, "link", 500), audience = s(f, "audience", 40);
  if (!title) back("/admin/notify", "A title is needed.");
  if (!can(admin, "broadcast.send")) {
    // Analysts draft; a super admin reviews the same form, prefilled, and sends it.
    const draft = Buffer.from(JSON.stringify({ title, body, link, audience, dealId: s(f, "dealId", 12), officeId: s(f, "officeId", 12), topic: s(f, "topic", 20), email: f.get("email") === "on", by: admin.name })).toString("base64url");
    await notifyDesk({ title: `${admin.name} drafted a message to offices: ${title}`, body: body.slice(0, 300) || null, link: `/admin/notify?draft=${draft}` });
    await log(admin, `Desk drafted "${title}" for a super admin to send`);
    back("/admin/notify", "Sent to a super admin to review and send.");
  }
  const db = await getDb();
  let ids: number[] = [];
  let dealId: number | null = null;
  if (audience === "approved") ids = (await db.select({ id: offices.id }).from(offices).where(eq(offices.approval, "approved"))).map((r) => r.id);
  else if (audience === "all") ids = (await db.select({ id: offices.id }).from(offices).where(ne(offices.approval, "rejected"))).map((r) => r.id);
  else if (audience === "pending") ids = (await db.select({ id: offices.id }).from(offices).where(eq(offices.approval, "pending"))).map((r) => r.id);
  else if (audience === "deal") { dealId = n(f, "dealId"); ids = await ndaOffices(dealId); }
  else if (audience === "office") ids = [n(f, "officeId")].filter(Boolean);
  if (!ids.length) back("/admin/notify", "Nobody is in that audience yet.");
  const [b] = await db.insert(broadcasts).values({ title, body: body || null, link: link || null, audience, dealId, sentBy: admin.name }).returning({ id: broadcasts.id });
  const topic = s(f, "topic", 20);
  const alert = dealId && topic && topic in ALERT_TOPICS ? { dealId, topic: topic as keyof typeof ALERT_TOPICS } : undefined;
  const r = await notifyOffices(ids, { title, body, link, broadcastId: b.id }, f.get("email") === "on", alert);
  await db.update(broadcasts).set({ recipients: r.recipients, emailed: r.emailed }).where(eq(broadcasts.id, b.id));
  await log(admin, `Desk sent "${title}" to ${r.recipients} offices`);
  back("/admin/notify", `Sent to ${r.recipients} ${r.recipients === 1 ? "office" : "offices"}${r.emailed ? `, ${r.emailed} emails` : ""}.`);
}

export async function saveSiteSettings(f: FormData) {
  const admin = await requireAdmin();
  await saveSettings({
    requireApproval: f.get("requireApproval") === "on", requirePan: false,
    announcement: s(f, "announcement", 300), announcementLink: s(f, "announcementLink", 500), notifyDeskEmail: s(f, "notifyDeskEmail", 200),
    promises: s(f, "promises", 3000) || DEFAULT_PROMISES, aiAnalyst: f.get("aiAnalyst") === "on", aiBudget: String(Math.max(0, Math.round(Number(s(f, "aiBudget", 10)) || 0))),
    analystContacts: f.get("analystContacts") === "on",
    referrals: f.get("referrals") === "on", approvalTime: s(f, "approvalTime", 120) || "usually within a few minutes",
  });
  await log(admin, "Desk changed the site settings");
  revalidatePath("/", "layout");
  back("/admin/settings", "Settings saved.");
}

export async function markDeskRead() {
  await requireDesk();
  const db = await getDb();
  await db.update(notifications).set({ readAt: new Date() }).where(sql`to_admin = true and read_at is null`);
  back("/admin", "Alerts marked read.");
}

// ---------------------------------------------------------------- invitations to family offices
export async function createInvites(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  const lines = s(f, "list", 20000).split(/\r?\n/).map((l) => l.split(/[,\t|]/).map((x) => x.trim())).filter((l) => l.some(Boolean));
  const EM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let made = 0, mailed = 0;
  const send = f.get("send") === "on" && emailReady();
  for (const parts of lines.slice(0, 300)) {
    const email = parts.find((x) => EM.test(x))?.toLowerCase();
    if (!email) continue;
    const rest = parts.filter((x) => x.toLowerCase() !== email);
    const [name = "", officeName = ""] = rest;
    const [used] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (used) continue;
    const token = randomBytes(18).toString("base64url");
    await db.insert(deskInvites).values({ token, email, name: name || null, officeName: officeName || null, createdBy: admin.name });
    made++;
    if (send) {
      const m = inviteEmail({ name, officeName, token, from: await signer(admin.id) });
      mailed += await sendRaw([email], m.subject, m.html, [], undefined, { kind: "invite" });
    }
  }
  await log(admin, `Desk created ${made} invitations`);
  back("/admin/invites", made ? `${made} invitation${made === 1 ? "" : "s"} ready${mailed ? `, ${mailed} emailed` : ""}. Copy a link to send it yourself.` : "No new emails found (already registered, or no email on the line).");
}

/** Who signs an invitation: the admin sending it, with their title at SintraCap. */
const TITLES: Record<string, string> = { "pratik@sintracap.in": "Managing Partner, SintraCap Advisors LLP", "puneetshah@sintracap.in": "VP, Investment Banking, SintraCap Advisors LLP" };
async function signer(adminId: number) {
  const db = await getDb();
  const [me] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, adminId));
  return { name: me?.name || "The desk", title: TITLES[me?.email || ""] || "SintraCap Advisors LLP", email: me?.email || "" };
}

/** Emails the admin a sample of the invitation, exactly as an investor would get it. */
export async function sendSampleInvite(f: FormData) {
  const admin = await requireAdmin();
  if (!emailReady()) back("/admin/invites", "Email is not set up yet: add RESEND_API_KEY in Vercel first.");
  const from = await signer(admin.id);
  const name = s(f, "name", 120) || "Sample Investor", officeName = s(f, "officeName", 160) || "Sample Family Office";
  const m = inviteEmail({ name, officeName, token: "sample", from });
  const ok = await sendRaw([from.email], "[Sample] " + m.subject, m.html, [], undefined, { kind: "test", step: "invite" });
  back("/admin/invites", ok ? `A sample invitation is on its way to ${from.email}.` : "The sample could not be sent. Check the Resend key and sender.");
}

// ---------------------------------------------------------------- onboarding email series
export async function setOnboardingEmails(f: FormData) {
  const admin = await requireAdmin();
  const on = f.get("on") === "1";
  await saveSettings({ onboardingEmails: on });
  await log(admin, `Desk turned the onboarding emails ${on ? "on" : "off"}`);
  back("/admin/emails", on ? "Onboarding emails are on." : "Onboarding emails are paused. Nothing is sent until you switch them back on.");
}

export async function sendTestOnboarding(f: FormData) {
  const admin = await requireAdmin();
  if (!emailReady()) back("/admin/emails", "Email is not set up yet: add RESEND_API_KEY in Vercel first.");
  const p = await preview(s(f, "key"));
  if (!p) back("/admin/emails", "No such email.");
  const db = await getDb();
  const [me] = await db.select({ email: users.email }).from(users).where(eq(users.id, admin.id));
  const ok = await sendRaw([me?.email || process.env.ADMIN_EMAIL || ""], "[Test] " + p!.subject, p!.html, [], undefined, { kind: "test", step: p!.step.key });
  back("/admin/emails#" + p!.step.key, ok ? `Test of "${p!.step.name}" sent to ${me?.email}.` : "The test could not be sent. Check the Resend key and sender.");
}

export async function backfillOnboarding() {
  const admin = await requireAdmin();
  const n = await backfill();
  await log(admin, `Desk queued ${n} onboarding emails for existing offices`);
  back("/admin/emails", n ? `${n} upcoming emails queued for offices approved before the series existed. Past steps are not sent.` : "Nothing to queue: every approved office is already past the series or already queued.");
}

// ---------------------------------------------------------------- founder portal: promoter access to one deal
export async function addPromoter(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const dealId = n(f, "dealId"), email = s(f, "email", 200).toLowerCase(), name = s(f, "name", 120), pw = s(f, "password", 200);
  const path = `/admin/deals/${dealId}#promoters`;
  if (!email || !name) back(path, "Name and email are needed.");
  const db = await getDb();
  const [d] = await db.select({ company: deals.company }).from(deals).where(eq(deals.id, dealId));
  if (!d) return;
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (u && (u.officeId || isDesk(u))) back(path, `${email} is already a family office or desk account. Use the promoter's own email.`);
  if (u) await db.update(users).set({ role: "promoter", promoterDealId: dealId, disabled: false, ...(pw.length >= 8 ? { passwordHash: await bcrypt.hash(pw, 10) } : {}) }).where(eq(users.id, u.id));
  else {
    if (pw.length < 8) back(path, "Set a temporary password of at least 8 characters.");
    await db.insert(users).values({ email, name, role: "promoter", promoterDealId: dealId, passwordHash: await bcrypt.hash(pw, 10) });
  }
  await log(admin, `Desk gave ${email} founder portal access for ${d.company}`, dealId);
  back(path, `${name} can now sign in to the founder portal for ${d.company}. Share the temporary password with them privately.`);
}

export async function removePromoter(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const id = n(f, "id");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || u.role !== "promoter") return;
  await db.update(users).set({ disabled: true }).where(eq(users.id, id));
  await signOutEverywhere(id);
  await log(admin, `Desk removed founder portal access for ${u.email}`, u.promoterDealId);
  back(`/admin/deals/${u.promoterDealId}#promoters`, `${u.name} no longer has founder portal access.`);
}

// ---------------------------------------------------------------- personal deal links
/** A link for one deal, for an office on the desk or for someone new (who registers already approved). */
export async function createDealLink(f: FormData) {
  const admin = await requirePerm("deals.edit");
  const dealId = n(f, "dealId"), path = `/admin/deals/${dealId}#share`;
  const db = await getDb();
  const [d] = await db.select({ company: deals.company }).from(deals).where(eq(deals.id, dealId));
  if (!d) return;
  let officeId = n(f, "officeId") || null;
  const email = s(f, "email", 200).toLowerCase(), name = s(f, "name", 120), officeName = s(f, "officeName", 160);
  if (!officeId) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) back(path, "Pick an office on the desk, or give a name and email for someone new.");
    const [u] = await db.select({ officeId: users.officeId, role: users.role }).from(users).where(eq(users.email, email));
    if (u && !u.officeId) back(path, `${email} is a desk or promoter account.`);
    if (u?.officeId) officeId = u.officeId; // already registered: link to their office
  }
  const token = randomBytes(12).toString("base64url");
  await db.insert(dealLinks).values({ token, dealId, officeId, email: officeId ? null : email, name: officeId ? null : name, officeName: officeId ? null : officeName || null, createdBy: admin.name });
  await log(admin, `Desk made a personal link to ${d.company} for ${officeId ? `office #${officeId}` : email}`, dealId);
  revalidatePath(`/admin/deals/${dealId}`);
  redirect(`/admin/deals/${dealId}?link=${token}#share`);
}
