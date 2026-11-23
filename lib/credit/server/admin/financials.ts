import "server-only";
import { desc, eq } from "drizzle-orm";
import { borrowerFinancials, borrowers } from "@/lib/credit/schema";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optAmount, optRate, uuidOrThrow } from "./common";

/*
 * Quarterly financials: AUM, GNPA and leverage, entered per quarter end. Each raise stays light, whatever the
 * borrower's drawdown cycle; these heavier figures update each quarter.
 */

import { isQuarterEnd } from "./financials-rules";
export { isQuarterEnd, lastQuarterEnd, financialsBehind } from "./financials-rules";

export async function saveFinancials(
  actor: AdminActor,
  borrowerId: string,
  input: { periodEnd: unknown; aum: unknown; gnpaPct: unknown; leverage: unknown },
) {
  const bId = uuidOrThrow(borrowerId);
  const periodEnd = String(input.periodEnd ?? "").trim();
  if (!isQuarterEnd(periodEnd)) throw new ValidationError("Choose a quarter end: 31 Mar, 30 Jun, 30 Sep or 31 Dec");
  if (periodEnd > new Date().toISOString().slice(0, 10)) throw new ValidationError("That quarter hasn't ended yet");
  const aum = optAmount(input.aum, "AUM");
  const gnpaPct = optRate(input.gnpaPct, "GNPA");
  const lev = String(input.leverage ?? "").trim();
  if (lev && !/^\d{1,6}(\.\d{1,2})?$/.test(lev)) throw new ValidationError("Leverage: enter a multiple, e.g. 3.25");
  const leverage = lev || null;
  if (!aum && !gnpaPct && !leverage) throw new ValidationError("Enter at least one figure");
  return asAdmin(actor, async (tx) => {
    const [b] = await tx.select({ id: borrowers.id }).from(borrowers).where(eq(borrowers.id, bId));
    if (!b) throw new NotFoundError();
    const values = { aum, gnpaPct, leverage, enteredBy: actor.userId, createdAt: new Date() };
    await tx
      .insert(borrowerFinancials)
      .values({ borrowerId: bId, periodEnd, ...values })
      .onConflictDoUpdate({ target: [borrowerFinancials.borrowerId, borrowerFinancials.periodEnd], set: values });
    await logActivity(tx, actor, "financials.saved", "borrower", bId, { periodEnd, aum, gnpaPct, leverage });
  });
}

export async function listFinancials(actor: AdminActor, borrowerId: string) {
  const bId = uuidOrThrow(borrowerId);
  return asAdmin(actor, (tx) =>
    tx.select().from(borrowerFinancials).where(eq(borrowerFinancials.borrowerId, bId)).orderBy(desc(borrowerFinancials.periodEnd)),
  );
}
