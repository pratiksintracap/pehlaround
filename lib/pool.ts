import "server-only";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects, sourcingPool } from "@/db/schema";
import { deskDeals } from "@/lib/desk";
import { normCompany } from "@/lib/prospects";

// The sourcing pool (see db/schema.ts). Rows arrive only by upload from the console; nothing about them is in the code.

const t = (v: unknown, n: number) => { const x = String(v ?? "").trim(); return x && x !== "nan" ? x.slice(0, n) : null; };
const f = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && String(v ?? "").trim() !== "" ? x : null; };
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const mail = (v: unknown) => { const x = (t(v, 200) ?? "").toLowerCase(); return EMAIL.test(x) ? x : null; };

export type PoolRow = Record<string, unknown>;

/** Adds or refreshes pool rows by company name. A row already picked keeps its outcome. */
export async function upsertPool(rows: PoolRow[], source: string) {
  const db = await getDb();
  let n = 0;
  const seen = new Set<string>();
  const vals = rows.slice(0, 400).flatMap((r) => {
    const company = t(r.company, 200), norm = company ? normCompany(company) : "";
    if (!company || !norm || seen.has(norm)) return [];
    seen.add(norm);
    const site = t(r.website, 300);
    return [{ company, norm, legalName: t(r.legal_name, 200), cin: t(r.cin, 30), website: site && /^https?:\/\/\S+$/.test(site) ? site : null, city: t(r.city, 80), state: t(r.state, 80),
      sector: t(r.sector, 160), overview: t(r.overview, 600), founded: f(r.founded) ? Math.round(f(r.founded)!) : null, fy: t(r.fy, 12), revenueCr: f(r.revenue_cr), patCr: f(r.pat_cr), ebitdaCr: f(r.ebitda_cr),
      stage: t(r.stage, 40), investors: t(r.investors, 400), people: t(r.people, 500), contactName: t(r.contact_name, 120), contactRole: t(r.contact_role, 120), contactEmail: mail(r.contact_email),
      companyEmail: mail(r.company_email), phone: t(r.phone, 60), linkedin: t(r.linkedin, 300), publicLtd: String(r.public_ltd) === "1" || r.public_ltd === true, partOf: t(r.part_of, 120),
      score: f(r.score) ?? 0, source }];
  });
  for (let i = 0; i < vals.length; i += 100) {
    const part = vals.slice(i, i + 100);
    await db.insert(sourcingPool).values(part).onConflictDoUpdate({ target: sourcingPool.norm, set: {
      company: sql`excluded.company`, legalName: sql`excluded.legal_name`, cin: sql`excluded.cin`, website: sql`excluded.website`, city: sql`excluded.city`, state: sql`excluded.state`,
      sector: sql`excluded.sector`, overview: sql`excluded.overview`, founded: sql`excluded.founded`, fy: sql`excluded.fy`, revenueCr: sql`excluded.revenue_cr`, patCr: sql`excluded.pat_cr`,
      ebitdaCr: sql`excluded.ebitda_cr`, stage: sql`excluded.stage`, investors: sql`excluded.investors`, people: sql`excluded.people`, contactName: sql`excluded.contact_name`,
      contactRole: sql`excluded.contact_role`, contactEmail: sql`excluded.contact_email`, companyEmail: sql`excluded.company_email`, phone: sql`excluded.phone`, linkedin: sql`excluded.linkedin`,
      publicLtd: sql`excluded.public_ltd`, partOf: sql`excluded.part_of`, score: sql`excluded.score`, source: sql`excluded.source` } });
    n += part.length;
  }
  return n;
}

export async function poolStats() {
  const db = await getDb();
  const [r] = await db.select({ total: sql<number>`count(*)::int`, waiting: sql<number>`count(*) filter (where ${sourcingPool.pickedAt} is null)::int`,
    prospects: sql<number>`count(*) filter (where ${sourcingPool.outcome} = 'prospect')::int`, skipped: sql<number>`count(*) filter (where ${sourcingPool.outcome} like 'skipped%')::int`,
    named: sql<number>`count(*) filter (where ${sourcingPool.pickedAt} is null and ${sourcingPool.contactEmail} is not null)::int` }).from(sourcingPool);
  return r;
}

export async function poolSearch(q: string, show: string) {
  const db = await getDb();
  const like = `%${q.trim().slice(0, 80)}%`;
  const where = and(show === "skipped" ? sql`${sourcingPool.outcome} like 'skipped%'` : show === "all" ? undefined : isNull(sourcingPool.pickedAt),
    q.trim() ? or(ilike(sourcingPool.company, like), ilike(sourcingPool.legalName, like), ilike(sourcingPool.sector, like), ilike(sourcingPool.city, like)) : undefined);
  return db.select().from(sourcingPool).where(where).orderBy(desc(sourcingPool.score), desc(sourcingPool.patCr)).limit(60);
}

/** The next companies for the assistant: highest score first, not yet picked, not already a prospect or a deal. */
export async function poolNext(n: number) {
  const db = await getDb();
  const take = Math.max(1, Math.min(60, Math.round(n) || 40));
  const have = new Set([...(await db.select({ norm: prospects.norm }).from(prospects)).map((p) => p.norm), ...(await deskDeals()).map((d) => normCompany(d.company))]);
  const rows = await db.select().from(sourcingPool).where(isNull(sourcingPool.pickedAt)).orderBy(desc(sourcingPool.score), desc(sourcingPool.patCr)).limit(take + 60);
  const dup = rows.filter((r) => have.has(r.norm));
  if (dup.length) await db.update(sourcingPool).set({ pickedAt: new Date(), outcome: "skipped: already on the desk" }).where(inArray(sourcingPool.id, dup.map((r) => r.id)));
  return rows.filter((r) => !have.has(r.norm)).slice(0, take).map((r) => ({ company: r.company, legalName: r.legalName, cin: r.cin, publicLimited: r.publicLtd, website: r.website, city: r.city, state: r.state,
    sector: r.sector, overview: r.overview, founded: r.founded, fy: r.fy, revenueCr: r.revenueCr, patCr: r.patCr, ebitdaCr: r.ebitdaCr, stage: r.stage, investors: r.investors, people: r.people,
    contactName: r.contactName, contactRole: r.contactRole, contactEmail: r.contactEmail, companyEmail: r.companyEmail, phone: r.phone, partOf: r.partOf }));
}

/** Marks a pool company as dealt with: it became a prospect, or was skipped for a stated reason. */
export async function poolMark(company: string, outcome: string) {
  const db = await getDb();
  const r = await db.update(sourcingPool).set({ pickedAt: new Date(), outcome: outcome.slice(0, 300) }).where(and(eq(sourcingPool.norm, normCompany(company)), isNull(sourcingPool.pickedAt))).returning({ id: sourcingPool.id });
  return r.length > 0;
}
