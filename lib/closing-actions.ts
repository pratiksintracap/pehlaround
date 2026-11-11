"use server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, dealUpdates, interests } from "@/db/schema";
import { requireAdmin, requirePerm, log } from "@/lib/auth";
import { done, fail, str, deskBack } from "@/lib/form";
import { investorWhere } from "@/lib/deal-guard";
import { notifyOffices } from "@/lib/notify";
import { closingFrom, freshSteps, fmtIso } from "@/lib/closing";

// After an allocation is agreed: the desk dates each closing step for one office, and publishes a company's updates to
// the offices that hold its shares. Both tell the offices concerned, and nobody else.

/** The dates of one request's closing steps. The office is told about each step dated for the first time. */
export async function saveClosing(f: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  const back = deskBack(f, "/admin/activity");
  const [prev] = await db.select().from(interests).where(eq(interests.id, Number(f.get("id"))));
  if (!prev) fail(back, "That request no longer exists.");
  if (prev!.status === "Withdrawn") fail(back, "This request was withdrawn.");
  const closing = closingFrom((k) => str(f, k, 12));
  await db.update(interests).set({ closing }).where(eq(interests.id, prev!.id));
  const fresh = freshSteps(prev!.closing, closing);
  const [d] = await db.select({ company: deals.company }).from(deals).where(investorWhere(eq(deals.id, prev!.dealId)));
  if (fresh.length && d) {
    const last = fresh[fresh.length - 1];
    const due = closing.fundsDue && !closing.funds ? `Funds are due by ${fmtIso(closing.fundsDue)}.` : null;
    await notifyOffices([prev!.officeId], { title: `${d.company}: ${last.told}`, body: due, link: "/dashboard#Portfolio" });
  } else if (d && closing.fundsDue && closing.fundsDue !== prev!.closing?.fundsDue && !closing.funds) {
    await notifyOffices([prev!.officeId], { title: `${d.company}: funds are due by ${fmtIso(closing.fundsDue)}`, link: "/dashboard#Portfolio" });
  }
  await log(admin, `Desk updated the closing steps of allocation #${prev!.id}${fresh.length ? `: ${fresh.map((s) => s.label.toLowerCase()).join(", ")}` : ""}`, prev!.dealId, { entity: "deal", entityId: prev!.dealId, officeId: prev!.officeId });
  done(back, fresh.length ? "Closing steps saved; the office is told." : "Closing steps saved.");
}

/** Write or edit an update for a company's holders. Publishing shows it under their Portfolio and tells them. */
export async function saveDealUpdate(f: FormData) {
  const publish = f.get("publish") === "1";
  const me = await requirePerm(publish ? "deals.publish" : "deals.edit");
  const dealId = Number(f.get("dealId")), id = Number(f.get("id")) || null;
  const back = `/admin/deals/${dealId}#updates`;
  const title = str(f, "title", 160), period = str(f, "period", 40) || null, body = str(f, "body", 6000);
  if (!title || !body) fail(back, "An update needs a title and some text.");
  const db = await getDb();
  const [d] = await db.select({ id: deals.id, company: deals.company }).from(deals).where(investorWhere(eq(deals.id, dealId)));
  if (!d) fail("/admin/deals", "That deal no longer exists.");
  const [prev] = id ? await db.select().from(dealUpdates).where(and(eq(dealUpdates.id, id), eq(dealUpdates.dealId, dealId))) : [];
  const now = new Date();
  const first = publish && prev?.status !== "published";
  const vals = { title, period, body, updatedAt: now, ...(publish ? { status: "published", publishedBy: prev?.publishedBy ?? me.name, publishedAt: prev?.publishedAt ?? now } : {}) };
  if (prev) await db.update(dealUpdates).set(vals).where(eq(dealUpdates.id, prev.id));
  else await db.insert(dealUpdates).values({ dealId, draftedBy: me.name, ...vals });
  let told = 0;
  if (first) {
    const holders = [...new Set((await db.select({ o: interests.officeId }).from(interests).where(and(eq(interests.dealId, dealId), eq(interests.status, "Allotted")))).map((r) => r.o))];
    told = holders.length;
    if (told) await notifyOffices(holders, { title: `${d!.company}: ${title}`, body: body.slice(0, 280) + (body.length > 280 ? "…" : ""), link: "/dashboard#Portfolio" });
  }
  await log(me, `Desk ${first ? "published" : prev ? "edited" : "drafted"} an update for ${d!.company}'s holders: ${title}`, dealId, { entity: "deal", entityId: dealId });
  done(back, first ? `Published. ${told} holder${told === 1 ? "" : "s"} told.` : publish ? "Update saved." : "Draft saved. Holders see it once it is published.");
}

/** Remove a draft, or take a published update back down (super admin). */
export async function removeDealUpdate(f: FormData) {
  const admin = await requireAdmin();
  const dealId = Number(f.get("dealId")), id = Number(f.get("id"));
  const db = await getDb();
  await db.delete(dealUpdates).where(and(eq(dealUpdates.id, id), eq(dealUpdates.dealId, dealId)));
  await log(admin, `Desk removed a holders' update (#${id})`, dealId, { entity: "deal", entityId: dealId });
  done(`/admin/deals/${dealId}#updates`, "Update removed.");
}
