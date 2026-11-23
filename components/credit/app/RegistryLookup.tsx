"use client";

import { useEffect, useRef, useState } from "react";

export type RegistryRow = { name: string; cin: string | null; rbiRegNo: string | null; state: string | null; office: string | null; type: string | null; layer: string | null };

const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

/**
 * Suggestions from RBI's register as someone types a name or a CIN. Picking one hands the whole row back so the
 * caller can fill the other fields. A full, valid CIN that matches exactly is picked automatically.
 */
export function RegistrySuggest({ query, onPick, autoPickCin = false }: { query: string; onPick: (r: RegistryRow) => void; autoPickCin?: boolean }) {
  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [closed, setClosed] = useState(false);
  const picked = useRef<string>("");
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || q === picked.current) {
      setRows([]);
      return;
    }
    setClosed(false);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/credit/registry?q=${encodeURIComponent(q)}`);
        const data: RegistryRow[] = r.ok ? await r.json() : [];
        if (autoPickCin && CIN_RE.test(q.toUpperCase()) && data.length === 1 && data[0].cin === q.toUpperCase()) {
          picked.current = q;
          onPick(data[0]);
          setRows([]);
          return;
        }
        setRows(data);
      } catch {
        setRows([]);
      }
    }, 300);
    return () => clearTimeout(t);
    // onPick is intentionally not a dependency: a new function each render must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, autoPickCin]);
  if (closed || rows.length === 0) return null;
  return (
    <div className="lookup" role="listbox" aria-label="Matches in RBI's register">
      <div className="lookup-head">
        <span>From RBI&apos;s register: pick one to fill in its details</span>
        <button type="button" className="link" onClick={() => setClosed(true)}>Close</button>
      </div>
      {rows.map((r) => (
        <button
          type="button"
          role="option"
          aria-selected={false}
          key={`${r.cin}-${r.name}`}
          onClick={() => {
            picked.current = r.name;
            setRows([]);
            onPick(r);
          }}
        >
          <strong>{r.name}</strong>
          <span className="muted small">{[r.cin, r.state, r.type, r.layer].filter(Boolean).join(" · ")}</span>
        </button>
      ))}
    </div>
  );
}
