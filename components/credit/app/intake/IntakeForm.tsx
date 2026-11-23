"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RegistrySuggest, type RegistryRow } from "@/components/credit/app/RegistryLookup";
import {
  answersFromRegistry,
  type Answers,
  type Column,
  type FileRef,
  type Question,
  type Section,
  essentialMissing,
  findQuestion,
  isEssential,
  missingItems,
  reportedAum,
  requiredCount,
  visibleSections,
} from "@/lib/credit/intake/definition";

type Band = { minCr: string; maxCr: string };
type SaveState = { kind: "idle" | "saving" | "saved" | "error"; message?: string; at?: string };

const UNIT: Record<string, string> = { crore: "₹ Cr", percent: "%", lakh: "₹ lakh", multiple: "x" };

export function IntakeForm({
  id,
  sections,
  initialAnswers,
  initialFiles,
  band,
  submissionApi = `/api/credit/intake/${id}`,
  fileApi = "/api/credit/intake/files",
}: {
  id: string;
  /** Where this form's answers, submit and new uploads go (partner: /api/intake/<id>; public: /api/apply/<token>). */
  submissionApi?: string;
  /** Base for an existing file's parts, completion, download and removal. */
  fileApi?: string;
  sections: Section[];
  initialAnswers: Answers;
  initialFiles: FileRef[];
  band: Band | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [files, setFiles] = useState<FileRef[]>(initialFiles);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [submitProblems, setSubmitProblems] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef<Answers | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  const visible = useMemo(() => visibleSections(sections, answers), [sections, answers]);
  const missing = useMemo(() => missingItems(sections, answers, files), [sections, answers, files]);
  const total = useMemo(() => requiredCount(sections, answers), [sections, answers]);
  const done = Math.max(0, total - missing.length);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inflight.current) await inflight.current;
    const body = pending.current;
    if (!body) return true;
    pending.current = null;
    setSave({ kind: "saving" });
    const p = (async () => {
      try {
        const res = await fetch(`${submissionApi}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSave({ kind: "error", message: data.error ?? "Couldn't save. Please try again." });
          if (!pending.current) pending.current = body; // retry with the next change or on submit
          return false;
        }
        setSave({ kind: "saved", at: data.savedAt });
        return true;
      } catch {
        setSave({ kind: "error", message: "You seem to be offline. Your answers will save when you're back." });
        if (!pending.current) pending.current = body;
        return false;
      }
    })();
    inflight.current = p;
    const ok = await p;
    inflight.current = null;
    return ok;
  }, [submissionApi]);

  const update = useCallback(
    (key: string, value: unknown) => {
      setAnswers((prev) => {
        const next = { ...prev, [key]: value };
        pending.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1200);
    },
    [flush],
  );

  /** Fill several answers from RBI's register at once (only the fields the register knows). */
  const fillFromRegistry = useCallback(
    (r: RegistryRow) => {
      const reg = answersFromRegistry(r);
      setAnswers((prev) => {
        const next: Answers = { ...prev, legal_name: r.name, ...(r.cin ? { cin: r.cin } : {}) };
        for (const [k, v] of Object.entries(reg)) if (k === "state" || !prev[k]) next[k] = v;
        pending.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 400);
    },
    [flush],
  );

  // Save before leaving the page.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [flush]);

  async function onSubmit() {
    setSubmitting(true);
    setSubmitProblems(null);
    const saved = await flush();
    if (!saved) {
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch(`${submissionApi}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setSubmitProblems([data.error ?? "Couldn't send just now. Please try again."]);
      else if (!data.ok) setSubmitProblems(data.problems);
      else {
        router.refresh();
        return;
      }
    } catch {
      setSubmitProblems(["You seem to be offline. Please try again when you're back."]);
    }
    setSubmitting(false);
  }

  const aum = reportedAum(answers);
  const essentials = essentialMissing(sections, answers);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [step, setStep] = useState(0);
  const last = visible.length; // the review step
  const at = Math.min(step, last);
  const go = (i: number) => {
    void flush();
    setStep(i);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const sectionState = (title: string, keys: string[]) => {
    const gaps = missing.filter((m) => m.section === title).length;
    const touched = keys.some((k) => answers[k] !== undefined && answers[k] !== "") || files.some((f) => keys.includes(f.questionKey));
    return gaps === 0 ? "done" : touched ? "started" : "todo";
  };
  const current = at < last ? visible[at] : null;
  useEffect(() => {
    document.querySelector(".path li.here")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [at]);

  return (
    <div className="intake">
      <div className="intake-top">
        <div className="meter" aria-label={`${pct}% complete`}>
          <div className="meter-bar"><span style={{ width: `${pct}%` }} /></div>
          <span><strong>{pct}%</strong> complete</span>
        </div>
        <SaveStatus s={save} />
      </div>

      <div className="intake-cols">
        <nav className="path" aria-label="Sections of the form">
          <ol>
            {visible.map((s, i) => {
              const state = sectionState(s.title, s.questions.map((q) => q.key));
              return (
                <li key={s.key} className={`${state} ${i === at ? "here" : ""}`}>
                  <button type="button" onClick={() => go(i)} aria-current={i === at ? "step" : undefined}>
                    <span className="node" aria-hidden="true" />
                    <span className="path-label">{s.title}</span>
                    <span className="sr-only">{state === "done" ? "complete" : state === "started" ? "started" : "not started"}</span>
                  </button>
                </li>
              );
            })}
            <li className={`review ${at === last ? "here" : ""}`}>
              <button type="button" onClick={() => go(last)} aria-current={at === last ? "step" : undefined}>
                <span className="node" aria-hidden="true" />
                <span className="path-label">Review and send</span>
              </button>
            </li>
          </ol>
        </nav>

        <div className="intake-body">
          {current ? (
            <section className="sheet" key={current.key} aria-labelledby={`h-${current.key}`}>
              <p className="sheet-count">Part {at + 1} of {last}</p>
              <h2 id={`h-${current.key}`}>{current.title}</h2>
              {current.intro && <p className="sheet-intro">{current.intro}</p>}
              {at === 0 && (
                <p className="sheet-intro">
                  Fill in what you have to hand. Only the answers marked <span className="need">needed to send</span> are required; the rest
                  helps lenders and you can add it later, or we&apos;ll cover it with you on a call.
                </p>
              )}
              {current.key === "financials" && band && aum != null && <SizeCheck aum={aum} band={band} />}
              <div className="qgrid">
                {current.questions.map((q) => (
                  <QuestionField
                    key={q.key}
                    q={q}
                    value={answers[q.key]}
                    answers={answers}
                    sections={sections}
                    onChange={(v) => update(q.key, v)}
                    onRegistry={fillFromRegistry}
                    files={files.filter((f) => f.questionKey === q.key)}
                    submissionApi={submissionApi}
                    fileApi={fileApi}
                    onFiles={(fn) => setFiles((prev) => fn(prev))}
                  />
                ))}
              </div>
              <div className="sheet-nav">
                {at > 0 ? (
                  <button type="button" className="secondary" onClick={() => go(at - 1)}>Back</button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => go(at + 1)}>{at + 1 === last ? "Review and send" : `Next: ${visible[at + 1].title}`}</button>
              </div>
            </section>
          ) : (
            <section className="sheet" aria-labelledby="h-review">
              <p className="sheet-count">Last step</p>
              <h2 id="h-review">Review and send</h2>
              {essentials.length > 0 ? (
                <div className="needs">
                  <p>To send the form we need:</p>
                  <ul>
                    {essentials.map((m) => {
                      const i = visible.findIndex((v) => v.title === m.section);
                      return (
                        <li key={m.key}>
                          <button type="button" className="link" onClick={() => go(Math.max(0, i))}>{m.label}</button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="sheet-intro">Everything needed to send is in. You can send it now, or keep adding detail first.</p>
              )}
              {missing.length > 0 && (
                <details className="later">
                  <summary>{missing.length} more answers or documents would help lenders. You can add them after sending, too.</summary>
                  <ul>
                    {missing.slice(0, 60).map((m) => {
                      const i = visible.findIndex((v) => v.title === m.section);
                      return (
                        <li key={m.key}>
                          <button type="button" className="link" onClick={() => go(Math.max(0, i))}>{m.label}</button>
                          <span className="muted"> in {m.section}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
              {submitProblems && submitProblems.length > 0 && (
                <div className="msg error" role="alert">
                  {submitProblems.length === 1 ? submitProblems[0] : <ul>{submitProblems.slice(0, 20).map((p) => <li key={p}>{p}</li>)}</ul>}
                </div>
              )}
              <div className="sheet-nav">
                <button type="button" className="secondary" onClick={() => go(last - 1)}>Back</button>
                <button type="button" onClick={onSubmit} disabled={essentials.length > 0 || submitting}>
                  {submitting ? "Sending…" : "Send to Before the Bell"}
                </button>
              </div>
              <p className="muted small">
                Once sent, the form is with the Before the Bell team. If they need more, they&apos;ll reopen it for you and say what&apos;s missing.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ s }: { s: SaveState }) {
  if (s.kind === "saving") return <div className="small muted">Saving…</div>;
  if (s.kind === "error") return <div className="small" style={{ color: "var(--bad)" }} role="alert">{s.message}</div>;
  if (s.kind === "saved" && s.at)
    return <div className="small muted">Saved {new Date(s.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</div>;
  return <div className="small muted">Answers save as you type</div>;
}

function SizeCheck({ aum, band }: { aum: number; band: Band }) {
  const min = Number(band.minCr);
  const max = Number(band.maxCr);
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (aum >= min && aum <= max)
    return <div className="msg ok" style={{ marginBottom: "0.9rem" }}>AUM of ₹{fmt(aum)} Cr is within the size Before the Bell works with (₹{fmt(min)}–{fmt(max)} Cr).</div>;
  return (
    <div className="note">
      AUM of ₹{fmt(aum)} Cr is {aum < min ? "below" : "above"} the ₹{fmt(min)}–{fmt(max)} Cr range Before the Bell usually works with. You can still send it; the
      team will look at it case by case.
    </div>
  );
}

// ---------- one question ----------

function QuestionField({
  q,
  value,
  answers,
  sections,
  onChange,
  files,
  submissionApi,
  fileApi,
  onFiles,
  onRegistry,
}: {
  onRegistry?: (r: RegistryRow) => void;
  q: Question;
  value: unknown;
  answers: Answers;
  sections: Section[];
  onChange: (v: unknown) => void;
  files: FileRef[];
  submissionApi: string;
  fileApi: string;
  onFiles: (fn: (prev: FileRef[]) => FileRef[]) => void;
}) {
  const f = q.field;
  const wide = ["textarea", "table", "perOption", "grid", "multi", "check"].includes(f.type);
  const inputId = `in-${q.key}`;
  const label = (
    <span className="qlabel">
      {q.label}
      {isEssential(q.key) && f.type !== "check" && <span className="need">needed to send</span>}
    </span>
  );
  const help = q.help && <span className="qhelp">{q.help}</span>;

  let control: React.ReactNode;
  switch (f.type) {
    case "text":
    case "email":
    case "phone":
    case "url":
    case "cin":
    case "date":
      control = (
        <input
          id={inputId}
          type={f.type === "phone" ? "tel" : f.type === "cin" ? "text" : f.type}
          value={typeof value === "string" ? value : ""}
          placeholder={"placeholder" in f ? f.placeholder : f.type === "cin" ? "U65999MH2010PTC000000" : undefined}
          maxLength={f.type === "cin" ? 21 : 300}
          autoCapitalize={f.type === "cin" ? "characters" : undefined}
          onChange={(e) => onChange(f.type === "cin" ? e.target.value.toUpperCase().replace(/\s/g, "") : e.target.value)}
        />
      );
      if (onRegistry && (q.key === "legal_name" || q.key === "cin"))
        control = (
          <div>
            {control}
            <RegistrySuggest query={typeof value === "string" ? value : ""} onPick={onRegistry} autoPickCin={q.key === "cin"} />
          </div>
        );
      break;
    case "textarea":
      control = <textarea id={inputId} value={typeof value === "string" ? value : ""} maxLength={4000} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "crore":
    case "percent":
    case "number":
    case "lakh":
    case "multiple":
      control = <NumberInput id={inputId} unit={UNIT[f.type]} value={value} onChange={onChange} />;
      break;
    case "select":
      control = (
        <select id={inputId} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Choose…</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
      break;
    case "multi": {
      const sel = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className={`multi ${f.options.length > 12 ? "many" : ""}`} role="group" aria-labelledby={`l-${q.key}`}>
          {f.options.map((o) => (
            <label key={o.value} className="opt">
              <input
                type="checkbox"
                checked={sel.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...sel, o.value] : sel.filter((x) => x !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "yesno":
      control = (
        <div className="seg" role="radiogroup" aria-labelledby={`l-${q.key}`}>
          {(["yes", "no"] as const).map((v) => (
            <label key={v} className={value === v ? "on" : ""}>
              <input type="radio" name={q.key} checked={value === v} onChange={() => onChange(v)} />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      );
      break;
    case "check":
      return (
        <div className="q wide" id={`q-${q.key}`}>
          <label className="check decl">
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked ? true : undefined)} />
            <span>
              {q.label}
              {isEssential(q.key) && <span className="need">needed to send</span>}
            </span>
          </label>
        </div>
      );
    case "table":
      control = <TableInput columns={f.columns} value={value} onChange={onChange} minRows={f.minRows ?? 1} maxRows={f.maxRows ?? 50} addLabel={f.addLabel ?? "Add row"} />;
      break;
    case "perOption": {
      const src = findQuestion(sections, f.from);
      const chosen = Array.isArray(answers[f.from]) ? (answers[f.from] as string[]) : [];
      const opts = src && src.field.type === "multi" ? src.field.options.filter((o) => chosen.includes(o.value)) : [];
      const obj = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, Record<string, string>>;
      control = (
        <div className="table-wrap">
          <table className="form-table">
            <thead>
              <tr>
                <th />
                {f.columns.map((c) => <th key={c.key}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {opts.map((o) => (
                <tr key={o.value}>
                  <th scope="row" className="rowhead">{o.label}</th>
                  {f.columns.map((c) => (
                    <td key={c.key}>
                      <Cell col={c} value={obj[o.value]?.[c.key]} onChange={(v) => onChange({ ...obj, [o.value]: { ...(obj[o.value] ?? {}), [c.key]: v } })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      break;
    }
    case "grid": {
      const obj = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, Record<string, string>>;
      control = (
        <div className="table-wrap">
          <table className="form-table grid">
            <thead>
              <tr>
                <th />
                {f.cols.map((c) => <th key={c.key} className="num">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {f.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="rowhead">{r.label}</th>
                  {f.cols.map((c) => (
                    <td key={c.key}>
                      <input
                        inputMode="decimal"
                        aria-label={`${r.label}, ${c.label}`}
                        value={obj[r.key]?.[c.key] ?? ""}
                        onChange={(e) => onChange({ ...obj, [r.key]: { ...(obj[r.key] ?? {}), [c.key]: cleanNum(e.target.value) } })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      break;
    }
    case "file":
      control = <FileInput q={q} multiple={Boolean(f.multiple)} files={files} submissionApi={submissionApi} fileApi={fileApi} onFiles={onFiles} />;
      break;
  }

  return (
    <div className={`q ${wide ? "wide" : ""}`} id={`q-${q.key}`}>
      {["multi", "yesno", "table", "perOption", "grid", "file"].includes(f.type) ? (
        <div className="qhead" id={`l-${q.key}`}>
          {label}
          {help}
        </div>
      ) : (
        <label htmlFor={inputId} className="qhead">
          {label}
          {help}
        </label>
      )}
      {control}
    </div>
  );
}

function cleanNum(s: string) {
  return s.replace(/[^\d.,\-]/g, "");
}

function NumberInput({ id, unit, value, onChange }: { id: string; unit?: string; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div className="unit-input">
      <input id={id} inputMode="decimal" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(cleanNum(e.target.value))} />
      {unit && <span>{unit}</span>}
    </div>
  );
}

function Cell({ col, value, onChange }: { col: Column; value: string | undefined; onChange: (v: string) => void }) {
  if (col.type === "select")
    return (
      <select aria-label={col.label} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">–</option>
        {col.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  if (col.type === "date") return <input aria-label={col.label} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  if (col.type === "text") return <input aria-label={col.label} value={value ?? ""} maxLength={300} onChange={(e) => onChange(e.target.value)} />;
  return <input aria-label={col.label} inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(cleanNum(e.target.value))} />;
}

function TableInput({
  columns,
  value,
  onChange,
  minRows,
  maxRows,
  addLabel,
}: {
  columns: Column[];
  value: unknown;
  onChange: (v: unknown) => void;
  minRows: number;
  maxRows: number;
  addLabel: string;
}) {
  const stored = Array.isArray(value) ? (value as Record<string, string>[]) : [];
  const rows = stored.length >= minRows ? stored : [...stored, ...Array.from({ length: minRows - stored.length }, (): Record<string, string> => ({}))];
  const set = (i: number, k: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="table-wrap">
      <table className="form-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} style={{ width: c.width ? `${c.width * 9}%` : undefined }}>{c.label}</th>)}
            <th aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>
                  <Cell col={c} value={r[c.key]} onChange={(v) => set(i, c.key, v)} />
                </td>
              ))}
              <td>
                {rows.length > minRows && (
                  <button type="button" className="link" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length < maxRows && (
        <button type="button" className="secondary small-btn" onClick={() => onChange([...rows, {}])}>
          + {addLabel}
        </button>
      )}
    </div>
  );
}

// ---------- uploads ----------

type Uploading = { name: string; pct: number; error?: string };

function FileInput({
  q,
  multiple,
  files,
  submissionApi,
  fileApi,
  onFiles,
}: {
  q: Question;
  multiple: boolean;
  files: FileRef[];
  submissionApi: string;
  fileApi: string;
  onFiles: (fn: (prev: FileRef[]) => FileRef[]) => void;
}) {
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const input = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    const set = (u: Partial<Uploading>) => setUploads((prev) => prev.map((x) => (x.name === file.name ? { ...x, ...u } : x)));
    setUploads((prev) => [...prev.filter((x) => x.name !== file.name), { name: file.name, pct: 0 }]);
    const fail = (msg: string) => set({ error: msg });
    try {
      const start = await fetch(`${submissionApi}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionKey: q.key, filename: file.name, size: file.size }),
      });
      const s = await start.json().catch(() => ({}));
      if (!start.ok) return fail(s.error ?? "Couldn't start the upload");
      for (let i = 0; i < s.partCount; i++) {
        const blob = file.slice(i * s.partBytes, Math.min(file.size, (i + 1) * s.partBytes));
        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          const r = await fetch(`${fileApi}/${s.fileId}/parts/${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: blob }).catch(() => null);
          if (r?.ok) ok = true;
          else if (r && r.status < 500) {
            const d = await r.json().catch(() => ({}));
            return fail(d.error ?? "Upload failed");
          }
        }
        if (!ok) return fail("Upload failed. Check your connection and try again.");
        set({ pct: Math.round(((i + 1) / s.partCount) * 100) });
      }
      const done = await fetch(`${fileApi}/${s.fileId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await done.json().catch(() => ({}));
      if (!done.ok) return fail(d.error ?? "Upload failed");
      onFiles((prev) => [
        ...(multiple ? prev : prev.filter((x) => x.questionKey !== q.key)),
        { id: d.id, questionKey: q.key, filename: d.filename, sizeBytes: d.sizeBytes },
      ]);
      setUploads((prev) => prev.filter((x) => x.name !== file.name));
    } catch {
      fail("Upload failed. Check your connection and try again.");
    }
  }

  async function remove(f: FileRef) {
    if (!window.confirm(`Remove ${f.filename}?`)) return;
    const r = await fetch(`${fileApi}/${f.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) onFiles((prev) => prev.filter((x) => x.id !== f.id));
  }

  return (
    <div className="files">
      {files.length > 0 && (
        <ul>
          {files.map((f) => (
            <li key={f.id}>
              <a href={`${fileApi}/${f.id}`}>{f.filename}</a> <span className="muted small">{size(f.sizeBytes)}</span>
              <button type="button" className="link" onClick={() => remove(f)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {uploads.map((u) => (
        <div key={u.name} className="small">
          {u.name}: {u.error ? <span style={{ color: "var(--bad)" }}>{u.error}</span> : `${u.pct}%`}
          {u.error && (
            <button type="button" className="link" onClick={() => setUploads((p) => p.filter((x) => x.name !== u.name))}>Dismiss</button>
          )}
        </div>
      ))}
      {(
        <label className="file-pick">
          <input
            ref={input}
            type="file"
            multiple={multiple}
            accept=".pdf,.xlsx,.xls,.docx,.csv,.png,.jpg,.jpeg,.zip"
            onChange={async (e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              for (const file of list) await uploadOne(file);
            }}
          />
          <span className="button secondary">{files.length === 0 ? "Choose file" : multiple ? "Add another file" : "Replace file"}</span>
        </label>
      )}
    </div>
  );
}

export function size(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
