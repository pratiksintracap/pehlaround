import { stateFromCin } from "./classify";

/**
 * Reads the CSV made from RBI's public list of registered NBFCs. Column names are matched loosely so a CSV saved
 * from RBI's spreadsheet or PDF works: name, CIN, registration number, regional office, address, email,
 * classification and layer. Only a name is required. Rows are keyed by CIN, else RBI registration number, else name.
 */

export type RegistryRow = {
  registryKey: string;
  name: string;
  cin: string | null;
  rbiRegNo: string | null;
  regionalOffice: string | null;
  address: string | null;
  registeredEmail: string | null;
  classification: string | null;
  layer: string | null;
  state: string | null;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const ALIASES: Record<keyof Omit<RegistryRow, "registryKey" | "state">, RegExp> = {
  name: /^(nbfc\s*)?(name|company\s*name|name\s*of\s*(the\s*)?(nbfc|company))$/,
  cin: /^(cin|corporate\s*identification\s*(number|no\.?))$/,
  rbiRegNo: /^((rbi\s*)?(cor|registration|reg\.?)\s*(no\.?|number)|certificate\s*(of\s*registration\s*)?(no\.?|number))$/,
  regionalOffice: /^(regional\s*office|ro|rbi\s*regional\s*office)$/,
  address: /^(registered\s*)?(office\s*)?address$/,
  registeredEmail: /^(e-?mail(\s*id)?|email\s*address)$/,
  classification: /^(classification|category|type|nbfc\s*(type|category|classification))$/,
  layer: /^(layer|regulatory\s*layer|sbr\s*layer)$/,
};

const clean = (v: string | undefined) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s && s !== "-" && s.toLowerCase() !== "na" && s.toLowerCase() !== "n/a" ? s : null;
};

export function parseRegistryCsv(text: string): { rows: RegistryRow[]; skipped: number } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], skipped: 0 };
  const header = table[0].map((h) => h.toLowerCase().replace(/[_]/g, " ").replace(/\s+/g, " ").trim());
  const idx = {} as Record<keyof typeof ALIASES, number>;
  for (const key of Object.keys(ALIASES) as (keyof typeof ALIASES)[]) idx[key] = header.findIndex((h) => ALIASES[key].test(h));
  if (idx.name < 0) return { rows: [], skipped: table.length - 1 };
  const out = new Map<string, RegistryRow>();
  let skipped = 0;
  for (const r of table.slice(1)) {
    const get = (k: keyof typeof ALIASES) => (idx[k] >= 0 ? clean(r[idx[k]]) : null);
    const name = get("name");
    if (!name) {
      skipped++;
      continue;
    }
    const cin = get("cin")?.toUpperCase() ?? null;
    const rbiRegNo = get("rbiRegNo");
    const email = get("registeredEmail")?.toLowerCase() ?? null;
    const registryKey = cin ? `cin:${cin}` : rbiRegNo ? `cor:${rbiRegNo.toUpperCase()}` : `name:${name.toUpperCase()}`;
    out.set(registryKey, {
      registryKey,
      name,
      cin,
      rbiRegNo,
      regionalOffice: get("regionalOffice"),
      address: get("address"),
      registeredEmail: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      classification: get("classification"),
      layer: get("layer"),
      state: stateFromCin(cin),
    });
  }
  return { rows: [...out.values()], skipped };
}
