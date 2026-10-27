// The desk's small building blocks (MODEL.md §7). New desk pages use these rather than writing their own; the
// classes they emit are the ones in globals.css, so a look changes in one place.
import { phaseInfo } from "@/lib/phase";

type FieldProps = {
  name: string; label: React.ReactNode; value?: string | number | null; hint?: React.ReactNode; ph?: string;
  type?: string; mode?: "decimal" | "numeric" | "email" | "tel"; max?: number; required?: boolean;
};

/** A labelled one-line input, filled with the current value. */
export function Field({ name, label, value, hint, ph, type, mode, max, required }: FieldProps) {
  return (
    <label>{label}<input name={name} type={type} defaultValue={value ?? ""} placeholder={ph} inputMode={mode} maxLength={max} required={required} />
      {hint ? <span className="hint">{hint}</span> : null}</label>
  );
}

/** A labelled text area. */
export function Area({ name, label, value, rows = 5, hint, ph }: { name: string; label: React.ReactNode; value?: string | null; rows?: number; hint?: React.ReactNode; ph?: string }) {
  return (
    <label>{label}<textarea name={name} rows={rows} defaultValue={value ?? ""} placeholder={ph} />{hint ? <span className="hint">{hint}</span> : null}</label>
  );
}

/** A deal's phase as a small tag, with what it means on hover. */
export function PhaseTag({ phase }: { phase: string }) {
  const p = phaseInfo(phase);
  return <span className={`pill ph-${p.id}`} title={p.desk}>{p.label}</span>;
}

/** The line a list shows when it has nothing in it. */
export function EmptyLi({ children }: { children: React.ReactNode }) {
  return <li className="empty-li">{children}</li>;
}
