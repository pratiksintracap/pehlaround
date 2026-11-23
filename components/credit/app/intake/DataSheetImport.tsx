"use client";

import { useState } from "react";

/** Pre-fills blank answers from the partner's NBFC data workbook (.xlsx). Answers already given are kept. */
export function DataSheetImport({ submissionApi }: { submissionApi: string }) {
  const [state, setState] = useState<{ busy?: boolean; error?: string; filled?: string[]; notes?: string[] }>({});
  async function run(f: File) {
    setState({ busy: true });
    const r = await fetch(`${submissionApi}/datasheet`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: f }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return setState({ error: d.error ?? "Couldn't read the workbook" });
    setState({ filled: d.filled, notes: d.notes });
  }
  return (
    <div className="stack">
      <label className="file-pick">
        <input type="file" accept=".xlsx" disabled={state.busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); e.target.value = ""; }} />
        <span className="button secondary">{state.busy ? "Reading…" : "Choose the data sheet (.xlsx)"}</span>
      </label>
      {state.error && <div className="msg error" role="alert">{state.error}</div>}
      {state.filled && (
        <div className="msg ok" role="status">
          Filled {state.filled.length} answers from the sheet: {state.filled.join(", ")}.
          {state.notes?.length ? <> {state.notes.join(" ")}</> : null}{" "}
          <button type="button" className="link" onClick={() => window.location.reload()}>Show them in the form</button>
        </div>
      )}
    </div>
  );
}
