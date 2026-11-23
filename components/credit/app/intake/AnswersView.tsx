import { type Answers, type Column, type FileRef, type Option, type Question, type Section, findQuestion, visibleSections } from "@/lib/credit/intake/definition";

/** Read-only view of a submission: only questions visible for these answers, in form order. */
export function AnswersView({ sections, answers, files, fileApi = "/api/credit/intake/files" }: { sections: Section[]; answers: Answers; files: FileRef[]; fileApi?: string }) {
  return (
    <>
      {visibleSections(sections, answers).map((s) => (
        <section className="panel" key={s.key} id={`s-${s.key}`}>
          <h2>{s.title}</h2>
          <dl className="answers">
            {s.questions.map((q) => (
              <Row key={q.key} q={q} answers={answers} sections={sections} files={files.filter((f) => f.questionKey === q.key)} fileApi={fileApi} />
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}

const optLabel = (opts: Option[], v: unknown) => opts.find((o) => o.value === v)?.label ?? String(v ?? "");
const unitFmt = (v: string | undefined, unit: string) => {
  if (v == null || v === "") return "—";
  if (unit === "crore") return `₹${v} Cr`;
  if (unit === "percent") return `${v}%`;
  if (unit === "lakh") return `₹${v} lakh`;
  if (unit === "multiple") return `${v}x`;
  return v;
};
const cellFmt = (c: Column, v: string | undefined) => (v == null || v === "" ? "—" : c.type === "select" ? optLabel(c.options, v) : unitFmt(v, c.type));

function Row({ q, answers, sections, files, fileApi }: { q: Question; answers: Answers; sections: Section[]; files: FileRef[]; fileApi: string }) {
  const v = answers[q.key];
  const f = q.field;
  let out: React.ReactNode = <span className="muted">—</span>;
  const empty = v == null || v === "";
  switch (f.type) {
    case "select":
      if (!empty) out = optLabel(f.options, v);
      break;
    case "multi":
      if (Array.isArray(v) && v.length) out = (v as string[]).map((x) => optLabel(f.options, x)).join(", ");
      break;
    case "yesno":
      if (!empty) out = v === "yes" ? "Yes" : "No";
      break;
    case "check":
      out = v === true ? "Confirmed" : <span className="muted">Not confirmed</span>;
      break;
    case "crore":
    case "percent":
    case "lakh":
    case "multiple":
      if (!empty) out = unitFmt(String(v), f.type);
      break;
    case "textarea":
      if (!empty) out = <span style={{ whiteSpace: "pre-wrap" }}>{String(v)}</span>;
      break;
    case "url":
      if (!empty) out = <span>{String(v)}</span>;
      break;
    case "table":
      if (Array.isArray(v) && v.length)
        out = (
          <div className="table-wrap">
            <table>
              <thead><tr>{f.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {(v as Record<string, string>[]).map((r, i) => (
                  <tr key={i}>{f.columns.map((c) => <td key={c.key} className={c.type === "text" || c.type === "select" ? "" : "num"}>{cellFmt(c, r[c.key])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      break;
    case "perOption": {
      const src = findQuestion(sections, f.from);
      const obj = (v ?? {}) as Record<string, Record<string, string>>;
      const chosen = Array.isArray(answers[f.from]) ? (answers[f.from] as string[]) : [];
      if (chosen.length && src?.field.type === "multi") {
        const opts = src.field.options.filter((o) => chosen.includes(o.value));
        out = (
          <div className="table-wrap">
            <table>
              <thead><tr><th />{f.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {opts.map((o) => (
                  <tr key={o.value}><th scope="row">{o.label}</th>{f.columns.map((c) => <td key={c.key}>{cellFmt(c, obj[o.value]?.[c.key])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      break;
    }
    case "grid": {
      const obj = (v ?? {}) as Record<string, Record<string, string>>;
      if (!empty)
        out = (
          <div className="table-wrap">
            <table>
              <thead><tr><th />{f.cols.map((c) => <th key={c.key} className="num">{c.label}</th>)}</tr></thead>
              <tbody>
                {f.rows.map((r) => (
                  <tr key={r.key}><th scope="row">{r.label}</th>{f.cols.map((c) => <td key={c.key} className="num">{unitFmt(obj[r.key]?.[c.key], r.unit === "number" ? "" : r.unit)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      break;
    }
    case "file":
      out = files.length ? (
        <ul className="plain">
          {files.map((x) => (
            <li key={x.id}><a href={`${fileApi}/${x.id}`}>{x.filename}</a> <span className="muted small">{fileSize(x.sizeBytes)}</span></li>
          ))}
        </ul>
      ) : (
        <span className="muted">No file</span>
      );
      break;
    default:
      if (!empty) out = String(v);
  }
  const wide = ["table", "perOption", "grid"].includes(f.type);
  return (
    <div className={`answer ${wide ? "wide" : ""}`} id={`q-${q.key}`}>
      <dt>{q.label}</dt>
      <dd>{out}</dd>
    </div>
  );
}

export function fileSize(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
