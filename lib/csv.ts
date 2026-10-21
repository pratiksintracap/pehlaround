// A small CSV reader for the desk's investor import: quoted fields, commas and new lines inside quotes,
// a header row (case and spacing ignored). No dependency; the files are a few hundred rows at most.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** Header names the import understands, with the spellings people use. */
const ALIASES: Record<string, string[]> = {
  name: ["name", "office", "office name", "investor", "investor name", "fund", "firm", "organisation", "organization", "company"],
  type: ["type", "investor type", "category"],
  contactName: ["contact", "contact name", "person", "contact person", "full name"],
  email: ["email", "e-mail", "email address", "contact email"],
  phone: ["phone", "mobile", "cell", "phone number", "contact number", "whatsapp"],
  city: ["city", "location"],
  ticket: ["ticket", "ticket size", "cheque", "cheque size"],
  website: ["website", "web", "url", "site"],
  notes: ["notes", "note", "comments", "remarks"],
};
export type InvestorRow = { name: string; type: string; contactName: string; email: string; phone: string; city: string; ticket: string; website: string; notes: string };

/** Rows of a CSV as investor records. The header row is required; unknown columns are ignored. */
export function investorRows(text: string): { rows: InvestorRow[]; missing: string[] } {
  const all = parseCsv(text);
  if (!all.length) return { rows: [], missing: ["name"] };
  const head = all[0].map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const col: Record<string, number> = {};
  for (const [k, names] of Object.entries(ALIASES)) { const i = head.findIndex((h) => names.includes(h)); if (i >= 0) col[k] = i; }
  if (col.name === undefined) return { rows: [], missing: ["name"] };
  const get = (r: string[], k: string) => (col[k] !== undefined ? (r[col[k]] ?? "").trim() : "");
  const rows = all.slice(1).map((r) => ({ name: get(r, "name"), type: get(r, "type"), contactName: get(r, "contactName"), email: get(r, "email").toLowerCase(),
    phone: get(r, "phone"), city: get(r, "city"), ticket: get(r, "ticket"), website: get(r, "website"), notes: get(r, "notes") })).filter((r) => r.name);
  return { rows, missing: [] };
}

/** "family office", "Fund", "AIF", "individual", "HNI" … → the site's investor types. */
export function investorType(v: string): "family_office" | "fund" | "individual" {
  const t = v.toLowerCase();
  if (/fund|aif|pms|vc|venture|capital|asset|amc|pe\b|private equity/.test(t)) return "fund";
  if (/individual|hni|angel|person/.test(t)) return "individual";
  return "family_office";
}
