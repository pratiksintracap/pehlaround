import { getSettings } from "@/lib/settings";
import { minTicket } from "@/lib/ticket";
import { investorWhere } from "@/lib/deal-guard";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { calls, dealPrefs, deals, interests, passes, questions, tasks } from "@/db/schema";
import { getUser, log } from "@/lib/auth";
import { getDeal, roomAccess } from "@/lib/deals";
import { track } from "@/lib/track";
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
  if (!user.officeId) return jerr("This action is for investors; the desk manages it in the admin.", 400);
  if (["interest", "question", "call", "pass"].includes(action) && !(await allow(`room:${user.id}`, 40, 3600))) return jerr(TOO_MANY, 429);
  const { data } = await readBody(req);
  const db = await getDb();
  const base = { dealId: d.id, officeId: user.officeId, userId: user.id };

  switch (action) {
    case "interest": {
      const it = d.room.interest;
      const min = minTicket(it, user.office?.investorType, (await getSettings()).hniMinCr);
      const amount = Number(data.amount);
      if (!isFinite(amount) || amount < min - 1e-9 || amount > it.max) return jerr(`Choose an amount between ${min < 1 ? `₹${Math.round(min * 100)} lakh` : `₹${min} Cr`} and ₹${it.max} Cr.`);
      if (!/commit/i.test(user.rights)) return jerr("Your access is view-only. Ask your office's principal to request an allocation.", 403);
      await db.insert(interests).values({ ...base, amountCr: String(amount), colead: !!data.colead });
      await log(user, `Requested an allocation of ₹${amount} Cr${data.colead ? " (co-lead interest)" : ""}: ${d.company}`, d.id);
      await track("allocation_requested", { ...base, meta: { amountCr: amount } });
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
      const priv = data.private === true || data.private === "on" || data.private === "true";
      await db.insert(questions).values({ ...base, question: q, private: priv });
      await log(user, `Asked the promoter a ${priv ? "private " : ""}question: ${d.company}`, d.id);
      await track("question_asked", base);
      await notifyDesk({ title: `New ${priv ? "private " : ""}question on ${d.company}`, body: `${user.office?.name}: ${q}`, link: "/admin/activity#qs" });
      break;
    }
    case "call": {
      const slot = str(data.slot, 60), who = str(data.who, 200);
      if (!slot || !who) return jerr("Choose a slot and say who will attend.");
      await db.insert(calls).values({ ...base, slot, attendees: who, questions: str(data.qs, 1500) || null });
      // Every request becomes a desk task for the deal's owner, due within the desk's target, so none sits unanswered.
      // Desk-only: tasks never show to investors, and no line is written to the office's log for it.
      const hours = Number((await getSettings()).callTargetHours) || 24;
      const due = new Date(Date.now() + hours * 3600e3 + 5.5 * 3600e3).toISOString().slice(0, 10);
      const [own] = await db.select({ ownerId: deals.ownerId }).from(deals).where(investorWhere(eq(deals.id, d.id)));
      await db.insert(tasks).values({ title: `Set up the management call ${user.office?.name ?? "an investor"} asked for (${slot})`, dealId: d.id, officeId: user.officeId,
        assigneeId: own?.ownerId ?? null, dueOn: due, createdBy: "Call request", notes: `Attendees: ${who}${data.qs ? `\nQuestions in advance: ${str(data.qs, 1500)}` : ""}` });
      await log(user, `Requested a management call: ${d.company}`, d.id);
      await track("call_requested", base);
      await notifyDesk({ title: `Call request: ${d.company}`, body: `${user.office?.name} · ${slot} · ${who}`, link: "/admin/activity#calls" });
      break;
    }
    case "prefs": {
      const [cur] = await db.select().from(dealPrefs).where(and(eq(dealPrefs.dealId, d.id), eq(dealPrefs.officeId, user.officeId)));
      const clean = (v: unknown) => Array.isArray(v) ? v.map((x) => str(x, 120)).filter(Boolean).slice(0, 20) : undefined;
      const alerts = clean(data.alerts), ticks = clean(data.ticks);
      if (!alerts && !ticks) return jerr("Nothing to save.");
      const set = { ...(alerts ? { alerts, alertsSet: true } : {}), ...(ticks ? { ticks } : {}) };
      if (cur) await db.update(dealPrefs).set(set).where(eq(dealPrefs.id, cur.id));
      else await db.insert(dealPrefs).values({ dealId: d.id, officeId: user.officeId, alerts: alerts ?? [], ticks: ticks ?? [], alertsSet: !!alerts });
      break;
    }
    default:
      return jerr("Unknown action.", 404);
  }
  return NextResponse.json({ ok: true });
}
