import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, offices } from "@/db/schema";

/** "+91 98765 43210", "098765-43210", "9876543210" -> "+919876543210". Ten digits starting 6–9 are taken as India. Null when it is not a number. */
export function normPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let d = s.replace(/\D/g, "");
  if (!d) return null;
  if (s.startsWith("+")) return d.length >= 8 && d.length <= 15 ? "+" + d : null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return "+91" + d;
  if (d.length === 12 && d.startsWith("91") && /^[6-9]/.test(d.slice(2))) return "+" + d;
  return d.length >= 8 && d.length <= 15 ? "+" + d : null;
}

/** "+919876543210" -> "+91 ••••• •3210", for telling someone where a code went without showing the number. */
export const maskPhone = (e164: string) => e164.slice(0, e164.length - 10) + " ••••• •" + e164.slice(-4);

/**
 * The one account a mobile number may sign in to: not disabled, and either on the desk or a promoter, or a member
 * whose office the desk has approved. A number on two such accounts signs in to neither, so a shared office line
 * cannot pick an account by chance; those people use their email.
 */
export async function userForPhone(raw: string) {
  const want = normPhone(raw);
  if (!want) return null;
  const db = await getDb();
  const rows = await db.select({ u: users, approval: offices.approval }).from(users).leftJoin(offices, eq(offices.id, users.officeId))
    .where(sql`right(regexp_replace(coalesce(${users.phone}, ''), '\\D', '', 'g'), 10) = ${want.replace(/\D/g, "").slice(-10)}`);
  const ok = rows.filter((r) => normPhone(r.u.phone) === want && !r.u.disabled && (r.u.role !== "member" || r.approval === "approved"));
  return ok.length === 1 ? { user: ok[0].u, phone: want } : null;
}
