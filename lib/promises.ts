import "server-only";
import { and, gte, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { questions } from "@/db/schema";

/** The desk's service commitments, one per line as "Promise | detail" (edited in admin settings). */
export const DEFAULT_PROMISES = [
  "Your room opens the moment you sign | The NDA is signed on screen. No waiting for the desk.",
  "Questions answered within 48 hours | By the promoter or the desk, in writing, in the room. Ask privately if you prefer.",
  "A promoter call within a week of asking | Request it from the room; the desk sets it up and confirms the slot.",
  "Allocation requests acknowledged the same working day | The desk confirms what is left in the round and the next step.",
  "New documents reach you first | Posted in the room with an alert under the bell, and by email if you choose.",
  "Every view logged against a name | Your office's own record of who saw what, in the Activity log.",
].join("\n");

export const parsePromises = (s: string) =>
  s.split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter(([t]) => t).slice(0, 8).map(([title, detail = ""]) => ({ title, detail }));

/** Measured over the last 90 days: how quickly questions asked by offices (not the desk's own seeded Q&A) were answered. */
export async function answerStats() {
  const db = await getDb();
  const since = new Date(Date.now() - 90 * 864e5);
  const rows = await db.select({ a: questions.askedAt, b: questions.answeredAt }).from(questions).where(and(isNotNull(questions.answeredAt), isNotNull(questions.officeId), gte(questions.askedAt, since)));
  const hrs = rows.map((r) => ((r.b as Date).getTime() - r.a.getTime()) / 36e5).filter((h) => h >= 0).sort((x, y) => x - y);
  if (hrs.length < 3) return null;
  const med = hrs.length % 2 ? hrs[(hrs.length - 1) / 2] : (hrs[hrs.length / 2 - 1] + hrs[hrs.length / 2]) / 2;
  const within48 = hrs.filter((h) => h <= 48).length / hrs.length;
  return { count: hrs.length, medianHours: med, within48 };
}
