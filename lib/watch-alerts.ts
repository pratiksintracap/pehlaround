import "server-only";
// Once a day: tell each office when a company it follows (or holds outside the desk, unlisted) reaches a new stage on
// the public IPO calendar: dates announced, open, closed, listed. Each stage is told once per office.
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { watches } from "@/db/schema";
import { notifyOffices } from "@/lib/notify";
import { IPO_DATA, istToday, fmtDay } from "@/lib/ipo-calendar";
import { findIssue, lockInEnds, newStages, seenThrough } from "@/lib/outside";

export async function runWatchAlerts(now = new Date()) {
  const today = istToday(now);
  const db = await getDb();
  const all = await db.select().from(watches);
  let told = 0;
  for (const w of all) {
    const i = findIssue(w.name, IPO_DATA.entries);
    if (!i) continue;
    const fresh = newStages(i, w.told, today);
    if (!fresh.length) continue;
    const last = fresh[fresh.length - 1];
    const detail = [i.exchange || i.board, i.band && `price band ${i.band}`, i.sizeCr && `issue ₹${i.sizeCr.toLocaleString("en-IN")} Cr`].filter(Boolean).join(" · ");
    const title = last === "soon" ? `${i.name}: IPO opens ${fmtDay(i.open)}` : last === "open" ? `${i.name}: IPO open until ${fmtDay(i.close)}` : last === "closed" ? `${i.name}: IPO closed${i.listing ? `, lists ${fmtDay(i.listing)}` : ""}` : `${i.name} has listed`;
    const lock = lockInEnds(i);
    const body = last === "listed" && lock ? `${detail}. Shares held before the IPO are locked in until about ${fmtDay(lock)}.` : detail;
    await notifyOffices([w.officeId], { title, body, link: "/dashboard#Holdings" });
    await db.update(watches).set({ told: [...new Set([...w.told, ...seenThrough(i, today)])] }).where(eq(watches.id, w.id));
    told++;
  }
  return { watches: all.length, told };
}
