import { STATUS_LABEL } from "@/lib/credit/server/diligence-rules";
import { cmp, formatINR, formatRate } from "@/lib/credit/server/decimal";
import { cycleLabel, cycleName } from "@/lib/credit/server/cycles";

const TONE: Record<string, string> = {
  approved: "ok", accepted: "ok", active: "ok", funded: "ok", sanctioned: "ok", disbursed: "ok", pass: "ok",
  in_review: "warn", received: "warn", interested: "warn", onboarding: "warn", open: "info", contacted: "warn", new: "warn",
  submitted: "info", needs_info: "bad",
  rejected: "bad", refresh_required: "bad", refresh_due: "bad", declined: "bad", cancelled: "bad", fail: "bad",
};

export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${TONE[status] ?? "idle"}`}>{label ?? STATUS_LABEL[status] ?? status.replace(/_/g, " ")}</span>;
}

export function Check({ value, label }: { value: string; label: string }) {
  const text = value === "pass" ? "fits" : value === "fail" ? "outside" : "not set";
  return <Badge status={value} label={`${label}: ${text}`} />;
}

export function Fill({ amount, filled }: { amount: string; filled: string }) {
  const pct = Number(amount) > 0 ? Math.min(100, (Number(filled) / Number(amount)) * 100) : 0;
  return (
    <div title={`${formatINR(filled)} of ${formatINR(amount)} filled`}>
      <div className="fill" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="small muted">
        {formatINR(filled)} of {formatINR(amount)}
        {cmp(filled, amount) >= 0 ? " · fully filled" : ""}
      </span>
    </div>
  );
}

export const inr = formatINR;
export const pct = formatRate;

/** A raise's period label, e.g. "Nov 2026", "Oct–Dec 2026", "Apr 2026–Mar 2027". */
export { cycleLabel, cycleName } from "@/lib/credit/server/cycles";

/** A raise's period with its cycle underneath, for table cells. */
export function Period({ start, cycle }: { start: string; cycle: string }) {
  return (
    <>
      {cycleLabel(start, cycle)} <span className="small muted">{cycleName(cycle).toLowerCase()}</span>
    </>
  );
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

export function date(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
}
