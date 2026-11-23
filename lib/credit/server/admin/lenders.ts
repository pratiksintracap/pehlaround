import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { lenders, lenderSegmentTargets, lenderSecurityLevels, lenderInstruments, instruments, segments, securityLevels, users } from "@/lib/credit/schema";
import { lenderExposures } from "../exposure";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optAmount, optRate, optText, reqText, uuidOrThrow } from "./common";
import { cmp } from "../decimal";

export async function listLenders(actor: AdminActor) {
  return asAdmin(actor, async (tx) => {
    const rows = await tx.select().from(lenders).orderBy(asc(lenders.name));
    const targets = await tx
      .select({ lenderId: lenderSegmentTargets.lenderId, name: segments.name })
      .from(lenderSegmentTargets)
      .innerJoin(segments, eq(segments.id, lenderSegmentTargets.segmentId));
    const levels = await tx
      .select({ lenderId: lenderSecurityLevels.lenderId, name: securityLevels.name })
      .from(lenderSecurityLevels)
      .innerJoin(securityLevels, eq(securityLevels.id, lenderSecurityLevels.securityLevelId));
    const insts = await tx
      .select({ lenderId: lenderInstruments.lenderId, name: instruments.name })
      .from(lenderInstruments)
      .innerJoin(instruments, eq(instruments.id, lenderInstruments.instrumentId));
    const exposure = await lenderExposures(tx, rows.map((r) => r.id));
    return rows.map((l) => ({
      ...l,
      segments: targets.filter((t) => t.lenderId === l.id).map((t) => t.name),
      securityLevels: levels.filter((t) => t.lenderId === l.id).map((t) => t.name),
      instruments: insts.filter((t) => t.lenderId === l.id).map((t) => t.name),
      outstanding: exposure.get(l.id)?.totalOutstanding ?? "0.00",
    }));
  });
}

export async function getLender(actor: AdminActor, id: string) {
  const lenderId = uuidOrThrow(id);
  return asAdmin(actor, async (tx) => {
    const [l] = await tx.select().from(lenders).where(eq(lenders.id, lenderId));
    if (!l) throw new NotFoundError();
    const targets = await tx.select().from(lenderSegmentTargets).where(eq(lenderSegmentTargets.lenderId, lenderId));
    const levels = await tx.select().from(lenderSecurityLevels).where(eq(lenderSecurityLevels.lenderId, lenderId));
    const team = await tx.select().from(users).where(eq(users.lenderId, lenderId)).orderBy(asc(users.name));
    const insts = await tx.select().from(lenderInstruments).where(eq(lenderInstruments.lenderId, lenderId));
    const exposure = (await lenderExposures(tx, [lenderId])).get(lenderId)!;
    return { lender: l, targets, securityLevelIds: levels.map((x) => x.securityLevelId), instrumentIds: insts.map((x) => x.instrumentId), team, exposure };
  });
}

export type LenderInput = {
  name: unknown;
  minTicket?: unknown;
  maxTicket?: unknown;
  minRate?: unknown;
  maxRate?: unknown;
  thesisNotes?: unknown;
  active?: unknown;
  /** segmentId -> target exposure (rupees or empty) */
  segmentTargets?: Record<string, unknown>;
  securityLevelIds?: string[];
  instrumentIds?: string[];
};

function parseLender(input: LenderInput) {
  const v = {
    name: reqText(input.name, "Lender name", 200),
    minTicket: optAmount(input.minTicket, "Minimum ticket"),
    maxTicket: optAmount(input.maxTicket, "Maximum ticket"),
    minRate: optRate(input.minRate, "Minimum rate"),
    maxRate: optRate(input.maxRate, "Maximum rate"),
    thesisNotes: optText(input.thesisNotes),
    active: input.active === undefined ? true : Boolean(input.active),
  };
  if (v.minTicket && v.maxTicket && cmp(v.minTicket, v.maxTicket) > 0) throw new ValidationError("Minimum ticket is above maximum ticket");
  if (v.minRate && v.maxRate && cmp(v.minRate, v.maxRate) > 0) throw new ValidationError("Minimum rate is above maximum rate");
  const targets = Object.entries(input.segmentTargets ?? {}).map(([segmentId, t]) => ({
    segmentId: uuidOrThrow(segmentId),
    targetExposure: optAmount(t, "Exposure target"),
  }));
  const levelIds = (input.securityLevelIds ?? []).map(uuidOrThrow);
  const instrumentIds = (input.instrumentIds ?? []).map(uuidOrThrow);
  return { v, targets, levelIds, instrumentIds };
}

export async function saveLender(actor: AdminActor, id: string | null, input: LenderInput): Promise<string> {
  const { v, targets, levelIds, instrumentIds } = parseLender(input);
  return asAdmin(actor, async (tx) => {
    let lenderId: string;
    let before: unknown = null;
    if (id) {
      lenderId = uuidOrThrow(id);
      const [existing] = await tx.select().from(lenders).where(eq(lenders.id, lenderId));
      if (!existing) throw new NotFoundError();
      before = existing;
      await tx.update(lenders).set({ ...v, updatedAt: new Date() }).where(eq(lenders.id, lenderId));
    } else {
      const [row] = await tx.insert(lenders).values(v).returning({ id: lenders.id });
      lenderId = row.id;
    }
    await tx.delete(lenderSegmentTargets).where(eq(lenderSegmentTargets.lenderId, lenderId));
    if (targets.length) await tx.insert(lenderSegmentTargets).values(targets.map((t) => ({ ...t, lenderId })));
    await tx.delete(lenderSecurityLevels).where(eq(lenderSecurityLevels.lenderId, lenderId));
    if (levelIds.length) await tx.insert(lenderSecurityLevels).values(levelIds.map((securityLevelId) => ({ lenderId, securityLevelId })));
    await tx.delete(lenderInstruments).where(eq(lenderInstruments.lenderId, lenderId));
    if (instrumentIds.length) await tx.insert(lenderInstruments).values(instrumentIds.map((instrumentId) => ({ lenderId, instrumentId })));
    await logActivity(tx, actor, id ? "lender.updated" : "lender.created", "lender", lenderId, {
      before,
      after: { ...v, targets, securityLevelIds: levelIds, instrumentIds },
    });
    return lenderId;
  });
}

export async function addUser(
  actor: AdminActor,
  input: { email: unknown; name: unknown; role: unknown; lenderId?: unknown },
): Promise<string> {
  const email = reqText(input.email, "Email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter a valid email");
  const name = reqText(input.name, "Name", 200);
  const role = String(input.role);
  if (!["platform_admin", "lender_admin", "lender_viewer"].includes(role)) throw new ValidationError("Invalid role");
  const lenderId = role === "platform_admin" ? null : uuidOrThrow(input.lenderId);
  return asAdmin(actor, async (tx) => {
    if (lenderId) {
      const [l] = await tx.select({ id: lenders.id }).from(lenders).where(eq(lenders.id, lenderId));
      if (!l) throw new NotFoundError();
    }
    const [dupe] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (dupe) throw new ValidationError("A user with this email already exists");
    const [u] = await tx
      .insert(users)
      .values({ email, name, role: role as "platform_admin" | "lender_admin" | "lender_viewer", lenderId })
      .returning({ id: users.id });
    await logActivity(tx, actor, "user.created", "user", u.id, { email, role, lenderId });
    return u.id;
  });
}

export async function setUserDisabled(actor: AdminActor, userId: string, disabled: boolean) {
  const id = uuidOrThrow(userId);
  if (id === actor.userId && disabled) throw new ValidationError("You cannot disable your own account");
  return asAdmin(actor, async (tx) => {
    const res = await tx.update(users).set({ disabledAt: disabled ? new Date() : null }).where(eq(users.id, id)).returning({ id: users.id });
    if (!res.length) throw new NotFoundError();
    await logActivity(tx, actor, disabled ? "user.disabled" : "user.enabled", "user", id);
  });
}

/** Clears a user's authenticator so they re-enrol on next sign-in (lost phone). */
export async function resetUserTotp(actor: AdminActor, userId: string) {
  const id = uuidOrThrow(userId);
  return asAdmin(actor, async (tx) => {
    const res = await tx.update(users).set({ totpSecret: null, totpEnabledAt: null }).where(eq(users.id, id)).returning({ id: users.id });
    if (!res.length) throw new NotFoundError();
    await logActivity(tx, actor, "user.totp_reset", "user", id);
  });
}

export async function listPlatformAdmins(actor: AdminActor) {
  return asAdmin(actor, (tx) => tx.select().from(users).where(inArray(users.role, ["platform_admin"])).orderBy(asc(users.name)));
}
