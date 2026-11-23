import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/lib/credit/db";
import { allocationMovements, borrowers, lenderSegmentTargets, raises, segments } from "@/lib/credit/schema";
import { add, cmp, sub } from "./decimal";

/*
 * Exposure is measured on amount outstanding (disbursed minus repaid), per lender, by the segment each raise
 * funds. Disbursed is tracked alongside. Callers run this inside their own DB context, so RLS still applies:
 * a lender context can only ever compute its own numbers.
 */

export type AllocationBalance = { allocationId: string; raiseId: string; lenderId: string; disbursed: string; repaid: string; outstanding: string };

export async function allocationBalances(tx: Tx, filter: { lenderIds?: string[]; raiseId?: string }): Promise<AllocationBalance[]> {
  const conds = [];
  if (filter.lenderIds) conds.push(inArray(allocationMovements.lenderId, filter.lenderIds.length ? filter.lenderIds : ["00000000-0000-0000-0000-000000000000"]));
  if (filter.raiseId) conds.push(eq(allocationMovements.raiseId, filter.raiseId));
  const rows = await tx
    .select()
    .from(allocationMovements)
    .where(conds.length ? and(...conds) : undefined);
  const by = new Map<string, AllocationBalance>();
  for (const m of rows) {
    const b = by.get(m.allocationId) ?? { allocationId: m.allocationId, raiseId: m.raiseId, lenderId: m.lenderId, disbursed: "0.00", repaid: "0.00", outstanding: "0.00" };
    if (m.kind === "disbursement") b.disbursed = add(b.disbursed, m.amount);
    else b.repaid = add(b.repaid, m.amount);
    b.outstanding = sub(b.disbursed, b.repaid);
    by.set(m.allocationId, b);
  }
  return [...by.values()];
}

export type SegmentExposure = {
  segmentId: string | null;
  segment: string;
  target: string | null;
  disbursed: string;
  outstanding: string;
  headroom: string | null;
};

export type LenderExposure = {
  lenderId: string;
  totalDisbursed: string;
  totalOutstanding: string;
  bySegment: SegmentExposure[];
  byBorrower: { borrowerId: string; borrower: string; disbursed: string; outstanding: string }[];
};

export async function lenderExposures(tx: Tx, lenderIds: string[]): Promise<Map<string, LenderExposure>> {
  const out = new Map<string, LenderExposure>();
  if (!lenderIds.length) return out;
  const balances = await allocationBalances(tx, { lenderIds });
  const raiseIds = [...new Set(balances.map((b) => b.raiseId))];
  const raiseRows = raiseIds.length
    ? await tx
        .select({ id: raises.id, segmentId: raises.segmentId, borrowerId: raises.borrowerId, borrower: borrowers.name })
        .from(raises)
        .innerJoin(borrowers, eq(borrowers.id, raises.borrowerId))
        .where(inArray(raises.id, raiseIds))
    : [];
  const segRows = await tx.select().from(segments);
  const targets = await tx.select().from(lenderSegmentTargets).where(inArray(lenderSegmentTargets.lenderId, lenderIds));

  for (const lenderId of lenderIds) {
    const mine = balances.filter((b) => b.lenderId === lenderId);
    const seg = new Map<string | null, SegmentExposure>();
    const bor = new Map<string, { borrowerId: string; borrower: string; disbursed: string; outstanding: string }>();
    for (const t of targets.filter((t) => t.lenderId === lenderId)) {
      seg.set(t.segmentId, {
        segmentId: t.segmentId,
        segment: segRows.find((s) => s.id === t.segmentId)?.name ?? "—",
        target: t.targetExposure,
        disbursed: "0.00",
        outstanding: "0.00",
        headroom: null,
      });
    }
    for (const b of mine) {
      const r = raiseRows.find((x) => x.id === b.raiseId);
      const key = r?.segmentId ?? null;
      const e = seg.get(key) ?? {
        segmentId: key,
        segment: key ? (segRows.find((s) => s.id === key)?.name ?? "—") : "Segment not set",
        target: null,
        disbursed: "0.00",
        outstanding: "0.00",
        headroom: null,
      };
      e.disbursed = add(e.disbursed, b.disbursed);
      e.outstanding = add(e.outstanding, b.outstanding);
      seg.set(key, e);
      if (r) {
        const x = bor.get(r.borrowerId) ?? { borrowerId: r.borrowerId, borrower: r.borrower, disbursed: "0.00", outstanding: "0.00" };
        x.disbursed = add(x.disbursed, b.disbursed);
        x.outstanding = add(x.outstanding, b.outstanding);
        bor.set(r.borrowerId, x);
      }
    }
    for (const e of seg.values()) e.headroom = e.target != null ? sub(e.target, e.outstanding) : null;
    out.set(lenderId, {
      lenderId,
      totalDisbursed: mine.reduce((a, b) => add(a, b.disbursed), "0.00"),
      totalOutstanding: mine.reduce((a, b) => add(a, b.outstanding), "0.00"),
      bySegment: [...seg.values()].sort((a, b) => a.segment.localeCompare(b.segment)),
      byBorrower: [...bor.values()].sort((a, b) => cmp(b.outstanding, a.outstanding)),
    });
  }
  return out;
}

/** segmentId -> headroom (null when no target) for matching. */
export function headroomMap(e: LenderExposure | undefined): Record<string, string | null> {
  const m: Record<string, string | null> = {};
  for (const s of e?.bySegment ?? []) if (s.segmentId) m[s.segmentId] = s.headroom;
  return m;
}
