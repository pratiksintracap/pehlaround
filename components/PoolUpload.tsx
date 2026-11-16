"use client";
import { useState } from "react";
import { loadPool } from "@/lib/sourcing-actions";

// Uploads the pool file (CSV) from the browser to the console in small batches. The file never touches the code repository.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let cur: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { cur.push(cell); cell = ""; }
    else if (c === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  const head = rows.shift() ?? [];
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

export function PoolUpload() {
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setMsg("Reading the file…");
    try {
      const rows = parseCsv((await file.text()).replace(/^﻿/, ""));
      if (!rows.length || !("company" in rows[0])) { setMsg("This file has no \"company\" column. Use the pool file prepared for the desk."); return; }
      let done = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const r = await loadPool(rows.slice(i, i + 200), file.name);
        if ("error" in r) { setMsg(`Stopped after ${done}: ${r.error}`); return; }
        done += r.loaded; setMsg(`Loaded ${done} of ${rows.length}…`);
      }
      setMsg(`Done: ${done} companies are in the pool. Reload the page to see them.`);
    } catch { setMsg("Couldn't load the file. Check your connection and try again; rows already loaded are kept."); }
    finally { setBusy(false); e.target.value = ""; }
  }
  return <div><label className="btn sm">{busy ? "Loading…" : "Upload a pool file (CSV)"}<input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} hidden /></label>
    {msg && <p className="fine" role="status" style={{ margin: "8px 0 0" }}>{msg}</p>}</div>;
}
