import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { calls, dealPrefs, interests, passes, questions } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { getDeal, roomAccess } from "@/lib/deals";
import { readBody, str, jerr } from "@/lib/http";
import { notifyDesk } from "@/lib/notify";
import { allow, TOO_MANY } from "@/lib/rate";

type P = { params: Promise<{ slug: string; action: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const { slug, action } = await params;
  const user = await getUser();
  if (!user) return jerr("Please sign in again.", 401);
  const d = await getDeal(slug);
  if (!d) return jerr("Deal not found.", 404);
  const access = await roomAccess(user, d);
  if (access.state !== "open") return jerr("This room is not open to your office.", 403);
  if (!user.officeId) return jerr("This action is for family offices; the desk manages it in the admin.", 400);
  if (["interest", "question", "call", "pass"].includes(action) && !(await allow(`room:${user.id}`, 40, 3600))) return jerr(TOO_MANY, 429);
  const { data } = await readBody(req);
  const db = await getDb();
  const base = { dealId: d.id, officeId: user.officeId, userId: user.id };

  switch (action) {
    case "interest": {
      const it = d.room.interest;
      const amount = Number(data.amount);
      if (!isFinite(amount) || amount < it.min || amount > it.max) return jerr(`Choose an amount between ₹${it.min} Cr and ₹${it.max} Cr.`);
      if (!/commit/i.test(user.rights)) return jerr("Your access is view-only. Ask your office's principal to request an allocation.", 403);
      await db.insert(interests).values({ ...base, amountCr: String(amount), colead: !!data.colead });
      await log(user, `Requested an allocation of ₹${amount} Cr${data.colead ? " (co-lead interest)" : ""}: ${d.company}`, d.id);
      await notifyDesk({ title: `Allocation request: ₹${amount} Cr in ${d.company}`, body: `${user.office?.name} · ${user.name}${data.colead ? " · co-lead interest" : ""}`, link: "/admin/activity" });
      break;
    }
    case "pass": {
      const reason = str(data.reason, 120);
      if (!reason) return jerr("Choose a reason.");
      await db.insert(passes).values({ ...base, reason, note: str(data.note, 300) || null });
      await log(user, `Passed: ${d.company} · ${reason}`, d.id);
      break;
    }
    case "question": {
      const q = str(data.question, 1000);
      if (q.length < 5) return jerr("Please write the question in full.");
      await db.insert(questions).values({ ...base, question: q });
      await log(user, `Asked the promoter a question: ${d.company}`, d.id);
      await notifyDesk({ title: `New question on ${d.company}`, body: q, link: "/admin/activity#qs" });
      break;
    }
    case "call": {
      const slot = str(data.slot, 60), who = str(data.who, 200);
      if (!slot || !who) return jerr("Choose a slot and say who will attend.");
      await db.insert(calls).values({ ...base, slot, attendees: who, questions: str(data.qs, 1500) || null });
      await log(user, `Requested a management call: ${d.company}`, d.id);
      await notifyDesk({ title: `Call request: ${d.company}`, body: `${user.office?.name} · ${slot} · ${who}`, link: "/admin/activity#calls" });
      break;
    }
    case "prefs": {
      const [cur] = await db.select().from(dealPrefs).where(and(eq(dealPrefs.dealId, d.id), eq(dealPrefs.officeId, user.officeId)));
      const clean = (v: unknown) => Array.isArray(v) ? v.map((x) => str(x, 120)).filter(Boolean).slice(0, 20) : undefined;
      const alerts = clean(data.alerts), ticks = clean(data.ticks);
      if (!alerts && !ticks) return jerr("Nothing to save.");
      if (cur) await db.update(dealPrefs).set({ ...(alerts ? { alerts } : {}), ...(ticks ? { ticks } : {}) }).where(eq(dealPrefs.id, cur.id));
      else await db.insert(dealPrefs).values({ dealId: d.id, officeId: user.officeId, alerts: alerts ?? [], ticks: ticks ?? [] });
      break;
    }
    default:
      return jerr("Unknown action.", 404);
  }
  return NextResponse.json({ ok: true });
}
