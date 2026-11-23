"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type F = { id: string; filename: string; sizeBytes: number };

const size = (n: number) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Files on a direct deal: upload in parts (any size up to 50 MB), download, remove. */
export function DealFiles({ dealId, files }: { dealId: string; files: F[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setBusy(`${file.name}: 0%`);
    const j = (r: Response) => r.json().catch(() => ({}));
    const start = await fetch(`/api/credit/deals/${dealId}/files`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size }) });
    const s = await j(start);
    if (!start.ok) return setError(s.error ?? "Couldn't start the upload");
    for (let i = 0; i < s.partCount; i++) {
      const blob = file.slice(i * s.partBytes, Math.min(file.size, (i + 1) * s.partBytes));
      let ok = false;
      for (let t = 0; t < 3 && !ok; t++) {
        const r = await fetch(`/api/credit/deals/files/${s.fileId}/parts/${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: blob }).catch(() => null);
        if (r?.ok) ok = true;
        else if (r && r.status < 500) return setError((await j(r)).error ?? "Upload failed");
      }
      if (!ok) return setError("Upload failed. Check your connection and try again.");
      setBusy(`${file.name}: ${Math.round(((i + 1) / s.partCount) * 100)}%`);
    }
    const done = await fetch(`/api/credit/deals/files/${s.fileId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!done.ok) return setError((await j(done)).error ?? "Upload failed");
  }

  async function remove(f: F) {
    if (!window.confirm(`Remove ${f.filename}?`)) return;
    const r = await fetch(`/api/credit/deals/files/${f.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (r.ok) router.refresh();
  }

  return (
    <div className="files">
      {files.length ? (
        <ul>
          {files.map((f) => (
            <li key={f.id}>
              <a href={`/api/credit/deals/files/${f.id}`}>{f.filename}</a> <span className="muted small">{size(f.sizeBytes)}</span>
              <button type="button" className="link" onClick={() => remove(f)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>No files yet.</p>
      )}
      {busy && <div className="small">{busy}</div>}
      {error && <div className="msg error" role="alert">{error}</div>}
      <label className="file-pick">
        <input
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.docx,.csv,.png,.jpg,.jpeg,.zip"
          disabled={Boolean(busy)}
          onChange={async (e) => {
            const list = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const file of list) await upload(file);
            setBusy(null);
            router.refresh();
          }}
        />
        <span className="button secondary">{busy ? "Uploading…" : "Add files"}</span>
      </label>
      <span className="muted small">PDF, Excel, Word, CSV, images or ZIP, up to 50 MB each.</span>
    </div>
  );
}
