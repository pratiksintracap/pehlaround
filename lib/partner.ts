import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { interests, ndas, offices, partnerTargets, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { isPartnerAdmin, isPartnerOffice, visibleClients, type Ask, type Client, type Nda, type Target } from "@/lib/partner-math";

/* A partner firm's book (MODEL.md §6, Partners): the offices its people introduced, which companies those offices
   signed NDAs for and what they asked for, and the targets the desk set. Never a client's documents, questions, notes
   or log. A principal (commit rights) sees the whole firm; a relationship manager sees only their own clients. */
export async function partnerBook(u: SessionUser) {
  if (!u.office || !isPartnerOffice(u.office)) return null;
  const db = await getDb();
  const admin = isPartnerAdmin(u);
  const [people, all, targets] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, rights: users.rights, refCode: users.refCode, disabled: users.disabled }).from(users).where(eq(users.officeId, u.office.id)),
    db.select({ id: offices.id, name: offices.name, approval: offices.approval, createdAt: offices.createdAt, rmId: offices.referredByUserId })
      .from(offices).where(eq(offices.referredBy, u.office.id)).orderBy(desc(offices.createdAt)),
    db.select().from(partnerTargets).where(eq(partnerTargets.officeId, u.office.id)),
  ]);
  const clients: Client[] = visibleClients(u, all);
  const ids = clients.map((c) => c.id);
  const [cNdas, cAsks]: [Nda[], Ask[]] = ids.length ? await Promise.all([
    db.select({ officeId: ndas.officeId, dealId: ndas.dealId, signedAt: ndas.signedAt }).from(ndas).where(and(inArray(ndas.officeId, ids), isNull(ndas.revokedAt))),
    db.select({ officeId: interests.officeId, dealId: interests.dealId, amountCr: interests.amountCr, status: interests.status }).from(interests).where(inArray(interests.officeId, ids)),
  ]) : [[], []];
  const t: Target[] = targets.map((x) => ({ dealId: x.dealId, leg: x.leg, intros: x.intros, amountCr: x.amountCr, note: x.note }));
  return { admin, people: people.filter((p) => !p.disabled && (admin || p.id === u.id)), clients, ndas: cNdas, asks: cAsks, targets: t, firmClients: all.length };
}
