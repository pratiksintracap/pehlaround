import "server-only";
import { withContext, type Tx } from "@/lib/credit/db";
import { type AdminActor, ForbiddenError, dbCtx, ValidationError } from "../actors";
import { AMOUNT_RE, RATE_RE } from "../decimal";

/** Runs fn in an admin DB context after a runtime check that the actor really is an admin. */
export function asAdmin<T>(actor: AdminActor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!actor || actor.kind !== "admin") throw new ForbiddenError();
  return withContext(dbCtx(actor), fn);
}

export function optAmount(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/,/g, "").trim();
  if (!AMOUNT_RE.test(s)) throw new ValidationError(`${field}: enter an amount in rupees`);
  return s;
}

export function reqAmount(v: unknown, field: string): string {
  const s = optAmount(v, field);
  if (s == null || Number(s) <= 0) throw new ValidationError(`${field} is required`);
  return s;
}

export function optRate(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/%/g, "").trim();
  if (!RATE_RE.test(s) || Number(s) > 100) throw new ValidationError(`${field}: enter a rate in % p.a.`);
  return s;
}

export function reqText(v: unknown, field: string, max = 500): string {
  const s = String(v ?? "").trim();
  if (!s) throw new ValidationError(`${field} is required`);
  if (s.length > max) throw new ValidationError(`${field} is too long`);
  return s;
}

export function optText(v: unknown, max = 5000): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

export function uuidOrThrow(v: unknown): string {
  const s = String(v ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new ValidationError("Invalid id");
  return s;
}
