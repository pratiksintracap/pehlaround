"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, documents, questions } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { notifyDesk } from "@/lib/notify";
import { investorWhere } from "@/lib/deal-guard";

// What a promoter can do from the founder portal. Nothing here reaches offices: the desk reviews and posts it.

const s = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const back = (msg: string, hash = "") => redirect(`/founder?msg=${encodeURIComponent(msg)}${hash}`);

async function promoter() {
  const u = await getUser();
  if (!u || u.role !== "promoter" || !u.promoterDealId) redirect("/login?next=/founder");
  const db = await getDb();
  const [d] = await db.select({ id: deals.id, company: deals.company }).from(deals).where(investorWhere(eq(deals.id, u.promoterDealId)));
  if (!d) redirect("/");
  return { u, d, db };
}

export async function draftAnswer(f: FormData) {
  const { u, d, db } = await promoter();
  const id = Number(f.get("id")), text = s(f, "answer", 4000);
  const [q] = await db.select().from(questions).where(and(eq(questions.id, id), eq(questions.dealId, d.id)));
  if (!q || q.answer || q.hidden) back("That question is no longer open.", "#qa");
  if (!text) back("Write an answer first.", "#qa");
  await db.update(questions).set({ draftAnswer: text, draftAt: new Date() }).where(eq(questions.id, id));
  await notifyDesk({ title: `${d.company}: the promoter drafted an answer`, body: q.question.slice(0, 200), link: "/admin/activity#qs" });
  await log(u, `Promoter drafted an answer for ${d.company}`, d.id);
  back("Sent to the desk. Offices see it once the desk posts it.", "#qa");
}

export async function suggestDocument(f: FormData) {
  const { u, d, db } = await promoter();
  const title = s(f, "title", 300), url = s(f, "url", 2000), kind = s(f, "kind", 80);
  if (!title || !/^https:\/\//i.test(url)) back("A title and a secure link (https://…) are needed.", "#docs");
  await db.insert(documents).values({ dealId: d.id, title, url, kind: kind || null, status: "proposed", proposedBy: u.name, sort: 500 });
  await notifyDesk({ title: `${d.company}: the promoter suggested a document`, body: `${title}${s(f, "note", 500) ? ` · ${s(f, "note", 500)}` : ""}`, link: `/admin/deals/${d.id}#docs` });
  await log(u, `Promoter suggested a document for ${d.company}: ${title}`, d.id);
  back("Sent to the desk. It goes into the data room once the desk checks it.", "#docs");
}

export async function messageDesk(f: FormData) {
  const { u, d } = await promoter();
  const text = s(f, "message", 2000);
  if (!text) back("Write a message first.", "#desk");
  await notifyDesk({ title: `${d.company}: message from ${u.name}`, body: text, link: `/admin/deals/${d.id}` });
  await log(u, `Promoter messaged the desk about ${d.company}`, d.id);
  back("Sent. The desk replies by phone or email.", "#desk");
}
