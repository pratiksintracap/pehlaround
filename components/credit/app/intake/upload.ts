/** Uploads one file to a form in 4 MB parts (the same protocol the form's own file fields use). */
export async function uploadToForm(
  submissionApi: string,
  fileApi: string,
  questionKey: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const start = await fetch(`${submissionApi}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionKey, filename: file.name, size: file.size }),
  }).catch(() => null);
  if (!start) return { ok: false, error: "Couldn't reach the server" };
  const s = await start.json().catch(() => ({}));
  if (!start.ok) return { ok: false, error: s.error ?? "Couldn't start the upload" };
  for (let i = 0; i < s.partCount; i++) {
    const blob = file.slice(i * s.partBytes, (i + 1) * s.partBytes);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const r = await fetch(`${fileApi}/${s.fileId}/parts/${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: blob }).catch(() => null);
      if (r?.ok) ok = true;
      else if (r && r.status < 500) {
        const d = await r.json().catch(() => ({}));
        return { ok: false, error: d.error ?? "Upload failed" };
      }
    }
    if (!ok) return { ok: false, error: "Upload failed. Check the connection and try again." };
    onProgress?.(Math.round(((i + 1) / s.partCount) * 100));
  }
  const done = await fetch(`${fileApi}/${s.fileId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const d = await done.json().catch(() => ({}));
  if (!done.ok) return { ok: false, error: d.error ?? "Upload failed" };
  return { ok: true };
}
