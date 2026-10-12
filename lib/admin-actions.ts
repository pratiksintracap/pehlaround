"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { articles, calls, deals, documents, interests, leads, ndas, offices, questions, users } from "@/db/schema";
import { requireAdmin, log } from "@/lib/auth";
import { fromText } from "@/lib/pipes";
import type { RoomContent } from "@/lib/types";
import ART from "@/lib/deal-art.json";

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const n = (f: FormData, k: string) => Number(f.get(k));
const back = (path: string, msg: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`);

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
  await log(admin, `Desk reset the password for user #${n(f, "id")}`);
  back("/admin/offices", "Password reset. Share it with the user privately.");
}

export async function toggleUser(f: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = n(f, "id");
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (u && u.role !== "admin") await db.update(users).set({ disabled: !u.disabled }).where(eq(users.id, id));
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
    roundLabel: s(f, "roundLabel", 80) || null, preMoney: s(f, "preMoney", 80) || null, peLabel: s(f, "peLabel", 80) || null, minTicket: s(f, "minTicket", 80) || null,
    open: f.get("open") === "on", published: f.get("published") === "on", sort: n(f, "sort") || 100, asOf: s(f, "asOf", 40) || null,
    ndaVersion: s(f, "ndaVersion", 40) || cur.ndaVersion,
    publicRisks: fromText.list(s(f, "publicRisks", 6000)),
    art: artKey && (ART as Record<string, string>)[artKey] ? (ART as Record<string, string>)[artKey] : cur.art,
    room, updatedAt: new Date(),
  }).where(eq(deals.id, id));
  await log(admin, `Desk updated the deal: ${s(f, "company", 200)}`, id);
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
  const vals = { title: s(f, "title", 300), kind: s(f, "kind", 80) || null, status: s(f, "status", 20) || "available", url: s(f, "url", 2000) || null, sort: n(f, "sort") || 100 };
  if (f.get("delete") === "on" && id) await db.delete(documents).where(eq(documents.id, id));
  else if (id) await db.update(documents).set(vals).where(eq(documents.id, id));
  else if (vals.title) await db.insert(documents).values({ ...vals, dealId });
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
  if (id) await db.update(calls).set(vals).where(eq(calls.id, id));
  else await db.insert(calls).values({ ...vals, dealId: n(f, "dealId"), kind: "session" });
  await log(admin, "Desk updated a call");
  back(s(f, "back") || "/admin/activity", "Call saved.");
}

export async function saveInterest(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  await db.update(interests).set({ status: s(f, "status", 40), note: s(f, "note", 1000) || null }).where(eq(interests.id, n(f, "id")));
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
  const vals = { slug, title, dek: s(f, "dek", 600) || null, body: s(f, "body", 40000), sources, externalUrl: s(f, "externalUrl", 1000) || null,
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
