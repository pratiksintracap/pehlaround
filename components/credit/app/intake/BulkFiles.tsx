"use client";

import { useState } from "react";
import { unzipSync } from "fflate";
import { guessQuestionKey } from "@/lib/credit/intake/filekeys";
import { uploadToForm } from "./upload";

type Item = { id: number; file: File; folder: string; key: string; include: boolean; status: "ready" | "uploading" | "done" | "error" | "skipped"; note?: string; pct?: number };
const ALLOWED = /\.(pdf|png|jpe?g|xlsx|xls|docx|csv|zip)$/i;
const MAX = 50 * 1024 * 1024;
let seq = 0;

/**
 * Drop everything a partner sent (ZIPs are opened in the browser) and file each document under the form item it
 * most likely belongs to. Every suggestion can be changed before uploading.
 */
export function BulkFiles({
  submissionApi,
  fileApi,
  options,
  existing,
}: {
  submissionApi: string;
  fileApi: string;
  options: { key: string; label: string }[];
  existing: string[];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const valid = new Set(options.map((o) => o.key));

  async function add(list: FileList | File[]) {
    const out: Item[] = [];
    const seen = new Set(items.map((i) => `${i.file.name}:${i.file.size}`));
    const have = new Set(existing.map((n) => n.toLowerCase()));
    const push = (file: File, folder: string) => {
      const sig = `${file.name}:${file.size}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      const guess = guessQuestionKey(file.name, folder);
      const ok = ALLOWED.test(file.name) && file.size > 0 && file.size <= MAX;
      const dupe = have.has(file.name.toLowerCase());
      out.push({
        id: ++seq,
        file,
        folder,
        key: valid.has(guess) ? guess : "doc_other",
        include: ok && !dupe,
        status: ok ? "ready" : "skipped",
        note: !ok ? (file.size > MAX ? "Over 50 MB" : "File type not accepted") : dupe ? "Already on the form" : undefined,
      });
    };
    for (const f of Array.from(list)) {
      if (/\.zip$/i.test(f.name)) {
        try {
          const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
          const zipName = f.name.replace(/\.zip$/i, "").replace(/^[0-9a-f]{8}-/, "");
          for (const [path, data] of Object.entries(entries)) {
            if (path.endsWith("/") || /(^|\/)(__MACOSX|\.)/.test(path) || !data.length) continue;
            const base = path.split("/").pop()!;
            const folder = [zipName, ...path.split("/").slice(0, -1)].filter(Boolean).join("/");
            push(new File([data as BlobPart], base), folder);
          }
        } catch {
          push(f, "");
        }
      } else push(f, "");
    }
    setItems((prev) => [...prev, ...out]);
  }

  async function uploadAll() {
    setBusy(true);
    setMsg(null);
    let ok = 0;
    let bad = 0;
    for (const it of items) {
      if (!it.include || it.status === "done") continue;
      setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: "uploading", pct: 0 } : x)));
      const r = await uploadToForm(submissionApi, fileApi, it.key, it.file, (pct) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, pct } : x))));
      if (r.ok) ok++;
      else bad++;
      setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: r.ok ? "done" : "error", note: r.ok ? undefined : r.error } : x)));
    }
    setBusy(false);
    setMsg(`${ok} uploaded${bad ? `, ${bad} failed` : ""}.`);
    if (ok && !bad) window.location.reload();
  }

  const todo = items.filter((i) => i.include && i.status !== "done").length;
  return (
    <div className="bulk">
      <label
        className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
      >
        <input type="file" multiple onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ""; }} />
        <strong>Drop all the files here</strong>
        <span className="muted small">or click to choose. ZIPs are opened and each file inside is listed. Up to 50 MB per file.</span>
      </label>
      {items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th /><th>File</th><th>Goes under</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className={it.include ? "" : "dim"}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Include ${it.file.name}`}
                        checked={it.include}
                        disabled={it.status === "skipped" || it.status === "done" || busy}
                        onChange={(e) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, include: e.target.checked } : x)))}
                      />
                    </td>
                    <td className="small">
                      {it.file.name}
                      <div className="muted">{it.folder && `${it.folder} · `}{(it.file.size / 1024 / 1024).toFixed(1)} MB</div>
                    </td>
                    <td>
                      <select
                        value={it.key}
                        disabled={busy || it.status === "done"}
                        aria-label={`Form item for ${it.file.name}`}
                        onChange={(e) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, key: e.target.value } : x)))}
                      >
                        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="small">
                      {it.status === "uploading" ? `Uploading ${it.pct ?? 0}%` : it.status === "done" ? "Uploaded" : it.status === "error" ? <span style={{ color: "var(--bad)" }}>{it.note}</span> : it.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inline" style={{ marginTop: "0.75rem", alignItems: "center" }}>
            <button type="button" onClick={uploadAll} disabled={busy || todo === 0}>{busy ? "Uploading…" : `Upload ${todo} file${todo === 1 ? "" : "s"}`}</button>
            <button type="button" className="secondary" onClick={() => setItems([])} disabled={busy}>Clear list</button>
            {msg && <span className="small" role="status">{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
