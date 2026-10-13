"use server";
import { startSeries, backfill, preview } from "@/lib/onboarding";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { articles, broadcasts, deskInvites, calls, deals, documents, interests, leads, ndas, notifications, offices, questions, users } from "@/db/schema";
import { notifyOffices, ndaOffices, sendEmail, emailReady } from "@/lib/notify";
import { sendRaw } from "@/lib/email";
import { randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/site";
import { saveSettings } from "@/lib/settings";
import { requireAdmin, log, signOutEverywhere } from "@/lib/auth";
import { fromText } from "@/lib/pipes";
import type { RoomContent } from "@/lib/types";
import ART from "@/lib/deal-art.json";

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const n = (f: FormData, k: string) => Number(f.get(k));
const back = (path: string, msg: string) => {
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
  const admin = await requireAdmin();
  const id = n(f, "id"), approval = s(f, "approval");
  if (!["approved", "pending", "rejected"].includes(approval)) return;
  const db = await getDb();
  const [o] = await db.select().from(offices).where(eq(offices.id, id));
  if (!o) return;
  await db.update(offices).set({ approval, approvedAt: approval === "approved" ? new Date() : null }).where(eq(offices.id, id));
  await log(admin, `Desk set ${o.name} to ${approval}`);
  if (approval === "approved" && o.approval !== "approved") {
    // In-app notice only: the "You're in" email of the onboarding series does the emailing.
    await notifyOffices([id], { title: "Your office is approved", body: "Every company on Pehla Round is now open to you by name. Sign a company's NDA on screen to open its deal room.", link: "/deals" }, false);
    const team = await db.select({ id: users.id }).from(users).where(and(eq(users.officeId, id), eq(users.disabled, false)));
    for (const t of team) await startSeries(t.id, "approved").catch(() => 0);
  }
  if (approval === "rejected" && o.approval !== "rejected" && f.get("tell") === "on")
    await notifyOffices([id], { title: "Your access is on hold", body: s(f, "reason", 1000) || "Please write to the desk and we will help.", link: "/dashboard" });
  revalidatePath("/admin/offices");
  back(s(f, "back") || "/admin/offices", approval === "approved" ? `${o.name} approved and told.` : "Office updated.");
}

export async function saveOfficeNotes(f: FormData) {
  await requireAdmin();
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
  if (u && u.role !== "admin") { await db.update(users).set({ disabled: !u.disabled }).where(eq(users.id, id)); await signOutEverywhere(id); }
  back("/admin/offices", "User updated.");
}

export async function revokeNda(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  await db.update(ndas).set({ revokedAt: new Date() }).where(eq(ndas.id, n(f, "id")));
  await log(admin, `Desk revoked NDA #${n(f, "id")}`);
  back("/admin/offices", "NDA access revoked.");
}

export async function addAdmin(f: FormData) {
  const admin = await requireAdmin();
  const email = s(f, "email", 200).toLowerCase(), name = s(f, "name", 120), pw = s(f, "password", 200);
  if (!email || !name || pw.length < 8) back("/admin", "Name, email and a password of 8+ characters are needed.");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (u) await db.update(users).set({ role: "admin" }).where(eq(users.id, u.id));
  else await db.insert(users).values({ email, name, role: "admin", passwordHash: await bcrypt.hash(pw, 10) });
  await log(admin, `Desk added ${email} as an admin`);
  back("/admin", `${email} is now an admin.`);
}

// ---------------------------------------------------------------- deals
export async function saveDeal(f: FormData) {
  const admin = await requireAdmin();
  const id = n(f, "id");
  const db = await getDb();
  const [cur] = await db.select().from(deals).where(eq(deals.id, id));
  if (!cur) return;
  const path = `/admin/deals/${id}`;
  let room: RoomContent;
  try {
    room = {
      ...cur.room,
      lede: s(f, "lede"), why: s(f, "why"), round: s(f, "round"), ticket: s(f, "ticket"), committed: s(f, "committed") || undefined,
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
  await db.update(deals).set({
    company: s(f, "company", 200), title: s(f, "title", 200), category: s(f, "category", 80), stage: s(f, "stage", 80), status: s(f, "status", 200),
    headline: s(f, "headline", 600), listingLabel: s(f, "listingLabel", 80), listingMonth: s(f, "listingMonth", 7) || null, listingNote: s(f, "listingNote", 200) || null,
    score: (() => { const v = parseFloat(s(f, "score", 10)); return isFinite(v) ? Math.round(Math.min(10, Math.max(0, v)) * 10) / 10 : null; })(),
    roundLabel: s(f, "roundLabel", 80) || null, preMoney: s(f, "preMoney", 80) || null, peLabel: s(f, "peLabel", 80) || null, minTicket: s(f, "minTicket", 80) || null,
    open: f.get("open") === "on", published: f.get("published") === "on", sort: n(f, "sort") || 100, asOf: s(f, "asOf", 40) || null,
    ndaVersion: s(f, "ndaVersion", 40) || cur.ndaVersion,
    publicRisks: fromText.list(s(f, "publicRisks", 6000)),
    art: artKey && (ART as Record<string, string>)[artKey] ? (ART as Record<string, string>)[artKey] : cur.art,
    room, updatedAt: new Date(),
  }).where(eq(deals.id, id));
  await log(admin, `Desk updated the deal: ${s(f, "company", 200)}`, id);
  // Newly published: tell approved offices, if the desk ticked the box.
  if (!cur.published && f.get("published") === "on" && f.get("announce") === "on") {
    const ids = (await db.select({ id: offices.id }).from(offices).where(eq(offices.approval, "approved"))).map((r) => r.id);
    await notifyOffices(ids, { title: `New on the desk: ${s(f, "company", 200)}`, body: `${s(f, "title", 200)} · ${s(f, "category", 80)}. ${s(f, "headline", 600)}`, link: `/deals/${cur.slug}` });
  }
  revalidatePath("/", "layout");
  back(path, "Saved. The site shows the change now.");
}

export async function createDeal(f: FormData) {
  const admin = await requireAdmin();
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
  redirect(`/admin/deals/${row.id}?msg=${encodeURIComponent("Created as a hidden draft. Fill it in, then tick Published.")}`);
}

// ---------------------------------------------------------------- documents
export async function saveDocument(f: FormData) {
  const admin = await requireAdmin();
  const dealId = n(f, "dealId"), id = n(f, "id");
  const db = await getDb();
  const audience = ["nda", "allocation", "offices"].includes(s(f, "audience", 20)) ? s(f, "audience", 20) : "nda";
  const officeIds = f.getAll("officeIds").map(Number).filter((x) => x > 0);
  const vals = { title: s(f, "title", 300), kind: s(f, "kind", 80) || null, status: s(f, "status", 20) || "available", url: s(f, "url", 2000) || null, sort: n(f, "sort") || 100, audience, officeIds };
  const [prev] = id ? await db.select().from(documents).where(eq(documents.id, id)) : [];
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
    await notifyOffices(to, { title: `${d?.company}: new in the data room`, body: vals.title, link: `/room/${d?.slug}` });
  }
  await log(admin, `Desk updated documents`, dealId);
  back(`/admin/deals/${dealId}#docs`, "Documents saved.");
}

// ---------------------------------------------------------------- Q&A, calls, interests, leads
export async function answerQuestion(f: FormData) {
  const admin = await requireAdmin();
  const id = n(f, "id"), answer = s(f, "answer", 4000);
  const db = await getDb();
  const [q] = await db.select().from(questions).where(eq(questions.id, id));
  if (!q) return;
  await db.update(questions).set({
    question: s(f, "question", 1000) || q.question, answer: answer || null, answeredBy: answer ? (s(f, "by", 80) || "Desk") : null,
    answeredAt: answer ? (q.answeredAt ?? new Date()) : null, hidden: f.get("hidden") === "on",
  }).where(eq(questions.id, id));
  await log(admin, `Desk ${answer ? "answered" : "updated"} a question`, q.dealId);
  if (answer && !q.answer && f.get("hidden") !== "on") {
    const [d] = await db.select({ company: deals.company, slug: deals.slug }).from(deals).where(eq(deals.id, q.dealId));
    const to = await ndaOffices(q.dealId);
    if (q.officeId) to.push(q.officeId);
    await notifyOffices(to, { title: `${d?.company}: a question is answered`, body: q.question.slice(0, 280), link: `/room/${d?.slug}` });
  }
  back(s(f, "back") || "/admin/activity", "Question saved.");
}

export async function addQuestion(f: FormData) {
  await requireAdmin();
  const db = await getDb();
  const q = s(f, "question", 1000), a = s(f, "answer", 4000);
  if (q) await db.insert(questions).values({ dealId: n(f, "dealId"), question: q, answer: a || null, answeredBy: a ? (s(f, "by", 80) || "Desk") : null, answeredAt: a ? new Date() : null });
  back(`/admin/deals/${n(f, "dealId")}#qa`, "Added to the room's Q&A.");
}

export async function saveCall(f: FormData) {
  const admin = await requireAdmin();
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
      body: vals.summary, link: `/room/${d?.slug}` });
  }
  await log(admin, "Desk updated a call");
  back(s(f, "back") || "/admin/activity", "Call saved.");
}

export async function saveInterest(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  const [prev] = await db.select().from(interests).where(eq(interests.id, n(f, "id")));
  await db.update(interests).set({ status: s(f, "status", 40), note: s(f, "note", 1000) || null }).where(eq(interests.id, n(f, "id")));
  if (prev && prev.status !== s(f, "status", 40)) {
    const [d] = await db.select({ company: deals.company }).from(deals).where(eq(deals.id, prev.dealId));
    await notifyOffices([prev.officeId], { title: `${d?.company}: your allocation request is ${s(f, "status", 40).toLowerCase()}`, body: s(f, "note", 1000) || null, link: "/dashboard" });
  }
  await log(admin, `Desk set allocation #${n(f, "id")} to ${s(f, "status", 40)}`);
  back("/admin/activity", "Allocation updated.");
}

export async function saveLead(f: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db.update(leads).set({ status: s(f, "status", 40) }).where(eq(leads.id, n(f, "id")));
  back("/admin/activity#leads", "Lead updated.");
}

// ---------------------------------------------------------------- articles
export async function saveArticle(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  const id = n(f, "id");
  const slug = s(f, "slug", 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const title = s(f, "title", 300);
  if (!slug || !title) back(id ? `/admin/articles/${id}` : "/admin/articles/new", "A title and a web address slug are needed.");
  const sources = s(f, "sources", 4000).split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[1]?.startsWith("http")).map(([t, u]) => ({ title: t || u, url: u }));
  const when = s(f, "publishedAt", 40);
  const vals = { slug, title, dek: s(f, "dek", 600) || null, body: s(f, "body", 40000), sources, externalUrl: s(f, "externalUrl", 1000) || null, image: s(f, "image", 1000) || null,
    author: s(f, "author", 120) || "Pehla Round desk", published: f.get("published") === "on",
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
  revalidatePath("/", "layout");
  back(`/admin/articles/${rid}`, "Saved.");
}

// ---------------------------------------------------------------- notifications and settings
export async function sendBroadcast(f: FormData) {
  const admin = await requireAdmin();
  const title = s(f, "title", 200), body = s(f, "body", 4000), link = s(f, "link", 500), audience = s(f, "audience", 40);
  if (!title) back("/admin/notify", "A title is needed.");
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
  const r = await notifyOffices(ids, { title, body, link, broadcastId: b.id }, f.get("email") === "on");
  await db.update(broadcasts).set({ recipients: r.recipients, emailed: r.emailed }).where(eq(broadcasts.id, b.id));
  await log(admin, `Desk sent "${title}" to ${r.recipients} offices`);
  back("/admin/notify", `Sent to ${r.recipients} ${r.recipients === 1 ? "office" : "offices"}${r.emailed ? `, ${r.emailed} emails` : ""}.`);
}

export async function saveSiteSettings(f: FormData) {
  const admin = await requireAdmin();
  await saveSettings({
    requireApproval: f.get("requireApproval") === "on", requirePan: f.get("requirePan") === "on",
    announcement: s(f, "announcement", 300), announcementLink: s(f, "announcementLink", 500), notifyDeskEmail: s(f, "notifyDeskEmail", 200),
  });
  await log(admin, "Desk changed the site settings");
  revalidatePath("/", "layout");
  back("/admin/settings", "Settings saved.");
}

export async function markDeskRead() {
  await requireAdmin();
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
    if (send) mailed += await sendEmail([email], { title: "Your invitation to Pehla Round",
      body: `${name ? `Dear ${name.split(" ")[0]},\n\n` : ""}The desk has invited ${officeName || "your family office"} to Pehla Round: undiscovered, profitable, IPO-bound companies, checked before you see them. Your invitation registers the office already approved, so every company on the desk opens to you by name.`,
      link: `${SITE_URL}/invite/${token}` });
  }
  await log(admin, `Desk created ${made} invitations`);
  back("/admin/invites", made ? `${made} invitation${made === 1 ? "" : "s"} ready${mailed ? `, ${mailed} emailed` : ""}. Copy a link to send it yourself.` : "No new emails found (already registered, or no email on the line).");
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
  const ok = await sendRaw([me?.email || process.env.ADMIN_EMAIL || ""], "[Test] " + p!.subject, p!.html);
  back("/admin/emails#" + p!.step.key, ok ? `Test of "${p!.step.name}" sent to ${me?.email}.` : "The test could not be sent. Check the Resend key and sender.");
}

export async function backfillOnboarding() {
  const admin = await requireAdmin();
  const n = await backfill();
  await log(admin, `Desk queued ${n} onboarding emails for existing offices`);
  back("/admin/emails", n ? `${n} upcoming emails queued for offices approved before the series existed. Past steps are not sent.` : "Nothing to queue: every approved office is already past the series or already queued.");
}
