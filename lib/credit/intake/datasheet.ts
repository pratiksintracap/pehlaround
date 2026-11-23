/*
 * Reads the "NBFC data" workbook that lenders and arrangers commonly circulate (tabs such as Company,
 * Operations, Share holding, Debt Profile, Products Brief, Product wise MOM DPD, CER, ALM) into the form's answers.
 *
 * It only carries over what the sheet states. Nothing is estimated: if a value is missing or ambiguous the
 * question is left blank for the company or the team to answer. Pure functions over a plain grid so the
 * mapping can be tested without Excel files.
 */
import { STATES, type Answers, type Section } from "./definition";

export type Cell = string | number | boolean | Date | null;
export type Grid = Record<string, Cell[][]>;
export type SheetImport = { answers: Answers; filled: string[]; notes: string[] };

const norm = (v: Cell) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim().toLowerCase());
const isNum = (v: Cell): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: Cell) => (v == null ? "" : v instanceof Date ? "" : String(v).replace(/\s+/g, " ").trim());
const fmt = (n: number, dp = 2) => String(Math.round(n * 10 ** dp) / 10 ** dp);
/** Percentages are stored either as fractions (0.379) or as numbers (37.9). */
const pct = (n: number) => (Math.abs(n) <= 1.5 ? n * 100 : n);
const ym = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  const small = new Set(["and", "of", "the", "for", "in"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy or a real date → yyyy-mm-dd. */
export function isoDate(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const m = str(v).match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "Mar24", "Mar-2024", a real date → that month (first day, UTC). */
function monthOf(v: Cell): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), 1));
  const m = str(v).match(/^([A-Za-z]{3})[a-z]*[\s'-]*(\d{2}|\d{4})$/);
  if (!m) return null;
  const mo = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].toLowerCase());
  if (mo < 0) return null;
  const y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return new Date(Date.UTC(y, mo, 1));
}

function sheet(g: Grid, re: RegExp): Cell[][] | null {
  const name = Object.keys(g).find((k) => re.test(k.trim()));
  return name ? g[name] : null;
}

/** Index of the first row whose label (in the first few cells) matches. */
function findRow(rows: Cell[][], re: RegExp, from = 0, cols = 3): number {
  for (let i = from; i < rows.length; i++) if (rows[i].slice(0, cols).some((c) => re.test(norm(c)))) return i;
  return -1;
}
const findCol = (row: Cell[], re: RegExp, from = 0) => {
  for (let i = from; i < row.length; i++) if (re.test(norm(row[i]))) return i;
  return -1;
};

/** Label → value pairs from a two-column sheet (label, then the first non-empty cell after it). */
function pairs(rows: Cell[][]): Map<string, Cell> {
  const out = new Map<string, Cell>();
  for (const r of rows) {
    const i = r.findIndex((c) => typeof c === "string" && c.trim());
    if (i < 0) continue;
    const v = r.slice(i + 1).find((c) => c != null && str(c) !== "" || c instanceof Date);
    if (v !== undefined) out.set(norm(r[i]), v);
  }
  return out;
}
const pick = (m: Map<string, Cell>, re: RegExp) => {
  for (const [k, v] of m) if (re.test(k)) return v;
  return null;
};
const blank = (v: Cell) => v == null || /^(-|na|n\/a|nil|none|not applicable|0)?$/i.test(str(v));

const STATE_BY_NAME = new Map(STATES.map((s) => [s.label.toLowerCase(), s.value]));
function stateIn(text: string): { value: string; index: number } | null {
  const t = text.toLowerCase();
  let best: { value: string; index: number } | null = null;
  for (const [name, value] of STATE_BY_NAME) {
    const i = t.lastIndexOf(name);
    if (i >= 0 && (!best || i > best.index)) best = { value, index: i };
  }
  return best;
}

function segmentFor(name: string, security: string): { seg: string; secured: "Yes" | "Partly" | "No" } {
  const n = name.toLowerCase();
  const nil = /^(nil|none|no|-|)$/i.test(security.trim());
  const prop = /propert|mortgage|house|land/i.test(security);
  const secured = nil ? "No" : prop || /gold|vehicle|hypothecation/i.test(security) ? "Yes" : "Partly";
  const seg =
    /\blap\b|against property|property/.test(n) ? "msme_lap"
    : /gold/.test(n) ? "gold"
    : /micro|jlg/.test(n) ? "mfi_jlg"
    : /home|housing/.test(n) ? "housing"
    : /two.?wheeler/.test(n) ? "two_wheeler"
    : /e-?rickshaw|three.?wheeler/.test(n) ? "three_wheeler_ev"
    : /tractor|farm equip/.test(n) ? "tractor"
    : /commercial vehicle|\bcv\b|vehicle/.test(n) ? "cv_used"
    : /education/.test(n) ? "education"
    : /supply chain|invoice|bill discount/.test(n) ? "supply_chain"
    : /\bagri/.test(n) ? "agri"
    : /against (shares|securities)|\blas\b/.test(n) ? "las"
    : /msme|business|sme/.test(n) ? (prop ? "msme_lap" : "msme_unsecured")
    : /personal|consumer|pay.?day|salary/.test(n) ? "personal"
    : "other";
  return { seg, secured: seg === "msme_lap" ? "Yes" : secured };
}

function facilityFor(t: string) {
  const s = t.toLowerCase();
  if (/term/.test(s)) return "term_loan";
  if (/cash credit|working capital|\bod\b|overdraft|\bcc\b/.test(s)) return "working_capital_cash_credit";
  if (/ncd|debenture/.test(s)) return "ncd";
  if (/commercial paper|\bcp\b/.test(s)) return "commercial_paper";
  if (/sub.?debt|subordinated/.test(s)) return "sub_debt";
  if (/ptc|securiti/.test(s)) return "securitisation_ptc";
  if (/assign/.test(s)) return "direct_assignment";
  if (/co.?lend/.test(s)) return "co_lending";
  if (/ecb/.test(s)) return "ecb";
  return "other";
}

/** Financial-year columns of the form's "Key numbers" grid, by the year their FY ends (31 March). */
function fyColumns(form: Section[]): { key: string; end: number }[] {
  const q = form.flatMap((s) => s.questions).find((x) => x.key === "fin");
  if (!q || q.field.type !== "grid") return [];
  return q.field.cols.flatMap((c) => {
    const m = c.label.match(/FY (\d{4})-(\d{2})/);
    return m ? [{ key: c.key, end: Number(m[1]) + 1 }] : [];
  });
}

export function answersFromDataSheet(g: Grid, form: Section[]): SheetImport {
  const a: Answers = {};
  const filled = new Set<string>();
  const notes: string[] = [];
  const fin: Record<string, Record<string, string>> = {};
  const setFin = (row: string, col: string, v: number | null, dp = 2) => {
    if (v == null || !Number.isFinite(v)) return;
    (fin[row] ??= {})[col] = fmt(v, dp);
  };
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    a[k] = v;
    filled.add(k);
  };
  const fyCols = fyColumns(form);
  const guard = (what: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      notes.push(`Couldn't read ${what}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ---------- Company ----------
  let keyPerson = "";
  guard("the Company tab", () => {
    const rows = sheet(g, /^company/i);
    if (!rows) return;
    const kv = pairs(rows);
    const name = str(pick(kv, /^name( of (the )?(company|nbfc))?$/));
    if (name) set("legal_name", titleCase(name));
    const cin = str(pick(kv, /^cin/)).toUpperCase().replace(/\s/g, "");
    if (/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(cin)) set("cin", cin);
    const cor = str(pick(kv, /rbi reg/));
    if (!blank(cor)) set("rbi_cor", cor);
    const inc = isoDate(pick(kv, /date of incorporation/));
    if (inc) set("incorporated_on", inc);
    const addr = str(pick(kv, /registered office/)) || str(pick(kv, /corporate office/));
    const st = addr ? stateIn(addr) : null;
    if (st) {
      set("state", st.value);
      const before = addr.slice(0, st.index).split(",").map((x) => x.replace(/[-\d]+$/g, "").trim()).filter(Boolean);
      const city = before.at(-1);
      if (city && city.length <= 40 && !/\d/.test(city)) set("city", titleCase(city.toUpperCase() === city ? city : city));
    }
    const type = norm(pick(kv, /type of nbfc/));
    if (/non.?deposit/.test(type)) set("deposit_taking", "no");
    else if (/deposit taking/.test(type)) set("deposit_taking", "yes");
    if (/micro|mfi/.test(type)) set("nbfc_type", "mfi");
    else if (/housing|hfc/.test(type)) set("nbfc_type", "hfc");
    else if (/factor/.test(type)) set("nbfc_type", "factor");
    else if (/infra|ifc/.test(type)) set("nbfc_type", "ifc");
    else if (/icc|investment and credit/.test(type)) set("nbfc_type", "icc");
    const cons = norm(pick(kv, /constitution/));
    if (/^(pvt|private|unlisted public|public unlisted)/.test(cons) || /unlisted/.test(cons)) set("listed", "no");
    keyPerson = str(pick(kv, /key person/));
    const auditor = str(pick(kv, /auditor/)).split(/[\n,]/)[0]?.trim();
    if (auditor && !blank(auditor)) set("auditor", titleCase(auditor));
    const nw = pick(kv, /net worth/);
    if (isNum(nw)) setFin("net_worth", "latest", nw);
    const crar = pick(kv, /^crar|capital adequacy/);
    if (isNum(crar)) setFin("crar", "latest", pct(crar));
    const hasRatingRow = [...kv.keys()].some((k) => /credit rating/.test(k));
    const rating = str(pick(kv, /credit rating/));
    if (!hasRatingRow) {
      // Not stated: leave it for the company to answer.
    } else if (!rating || blank(rating) || /^not rated|unrated$/i.test(rating)) set("rated", "no");
    else {
      set("rated", "yes");
      set("rating", rating.slice(0, 120));
    }
  });

  // ---------- Operations: size, branches, people, disbursements ----------
  let latestMonth: Date | null = null;
  guard("the Operations tab", () => {
    const rows = sheet(g, /^operations?/i);
    if (!rows) return;
    const h = rows.findIndex((r) => r.filter((c) => c instanceof Date || monthOf(c)).length >= 2);
    if (h < 0) return;
    const cols = rows[h].map((c, i) => ({ i, m: monthOf(c) })).filter((x): x is { i: number; m: Date } => !!x.m);
    const valueAt = (r: Cell[], i: number) => (isNum(r[i]) ? r[i] : null);
    const lastWith = (r: Cell[]) => [...cols].reverse().find((c) => valueAt(r, c.i) != null);
    const branchesRow = rows[findRow(rows, /no\.? of branches/, h)] ?? [];
    const latest = lastWith(branchesRow) ?? cols.at(-1)!;
    latestMonth = latest.m;
    const at = (re: RegExp, nth = 0) => {
      let i = h;
      for (let k = 0; k <= nth; k++) {
        i = findRow(rows, re, i + 1);
        if (i < 0) return null;
      }
      return rows[i];
    };
    const latestOf = (r: Cell[] | null) => (r ? valueAt(r, latest.i) : null);
    const b = latestOf(branchesRow);
    if (b != null) set("branches", String(Math.round(b)));
    const staff = latestOf(at(/total staff/));
    if (staff != null) set("employees", String(Math.round(staff)));
    // Loan outstanding: first row is the owned book, the second the managed (off-book) one.
    const owned = at(/loan outstanding/, 0);
    const managed = at(/loan outstanding/, 1);
    const fyCol = (end: number) => cols.find((c) => c.m.getUTCFullYear() === end && c.m.getUTCMonth() === 2);
    for (const [row, r] of [["aum_on", owned], ["aum_off", managed]] as const) {
      if (!r) continue;
      setFin(row, "latest", latestOf(r));
      for (const fy of fyCols) {
        const c = fyCol(fy.end);
        if (c) setFin(row, fy.key, valueAt(r, c.i));
      }
    }
    const gross = rows.slice(h).filter((r) => r.slice(0, 3).some((c) => /no\.? of active loans/.test(norm(c))));
    const loans = gross.length ? latestOf(gross.at(-1)!) : null;
    if (loans != null) set("active_loans", String(Math.round(loans)));
    // Disbursements are reported per quarter: the latest quarter, and a financial year when all four quarters are there.
    const disb = at(/disbursement amount \(owned\)|disbursement amount/);
    if (disb) {
      setFin("disbursed", "latest", latestOf(disb));
      for (const fy of fyCols) {
        const qs = [-9, -6, -3, 0].map((d) => cols.find((c) => ym(c.m) === fy.end * 12 + 2 + d));
        if (qs.every((q) => q && valueAt(disb, q.i) != null)) setFin("disbursed", fy.key, qs.reduce((s, q) => s + valueAt(disb, q!.i)!, 0));
      }
    }
    const wo = at(/write.?off amount/);
    if (wo) {
      const vals = cols.map((c) => valueAt(wo, c.i)).filter((v): v is number => v != null);
      if (vals.length && vals.every((v) => v === 0)) set("writeoffs", "0");
    }
    const end = new Date(Date.UTC(latest.m.getUTCFullYear(), latest.m.getUTCMonth() + 1, 0));
    set("latest_period_end", end.toISOString().slice(0, 10));
  });

  // ---------- Shareholding, capital adequacy ----------
  const holdings = new Map<string, number>();
  guard("the Share holding tab", () => {
    const rows = sheet(g, /^share ?holding/i);
    if (!rows) return;
    let promoter = 0;
    let others = 0;
    for (const r of rows) {
      const t = r.findIndex((c) => typeof c === "string" && c.trim());
      if (t < 0) continue;
      const type = norm(r[t]);
      const p = r.slice(t + 1).filter(isNum).at(-1);
      if (!/promoter|public|investor|institution|other|fii|fund/.test(type) || p == null) continue;
      const name = str(r[t + 1]);
      if (name) holdings.set(name.toLowerCase(), pct(p));
      if (/promoter/.test(type)) promoter += pct(p);
      else others += pct(p);
    }
    if (promoter > 0) set("promoter_holding", fmt(promoter, 1));
    if (promoter > 99.5 && others === 0) set("institutional", "no");
    const h = findRow(rows, /capital adequacy ratio/);
    const r = findRow(rows, /total capital adequacy/, Math.max(h, 0));
    if (h >= 0 && r >= 0) {
      const cols = rows[h].map((c, i) => ({ i, m: monthOf(c) })).filter((x): x is { i: number; m: Date } => !!x.m);
      const v = (c?: { i: number }) => (c && isNum(rows[r][c.i]) ? pct(rows[r][c.i] as number) : null);
      const last = [...cols].reverse().find((c) => isNum(rows[r][c.i]));
      if (!fin.crar?.latest) setFin("crar", "latest", v(last));
      for (const fy of fyCols) setFin("crar", fy.key, v(cols.find((c) => c.m.getUTCFullYear() === fy.end && c.m.getUTCMonth() === 2)));
    }
  });

  // ---------- Board and key people ----------
  guard("the BoD tab", () => {
    const rows = sheet(g, /^(bod|board)/i);
    if (!rows) return;
    const h = rows.findIndex((r) => r.some((c) => /^name/.test(norm(c))));
    if (h < 0) return;
    const head = rows[h];
    const ci = {
      name: findCol(head, /^name/),
      role: findCol(head, /designation/),
      phone: findCol(head, /contact|mobile|phone/),
      email: findCol(head, /e-?mail/),
      years: findCol(head, /years of experience|experience/),
    };
    const people = rows
      .slice(h + 1)
      .map((r) => ({ name: titleCase(str(r[ci.name])), role: str(r[ci.role]), phone: ci.phone >= 0 ? str(r[ci.phone]) : "", email: ci.email >= 0 ? str(r[ci.email]) : "", years: ci.years >= 0 ? r[ci.years] : null }))
      .filter((p) => p.name && !/^name/i.test(p.name));
    if (!people.length) return;
    const holdingOf = (n: string) => {
      const k = n.toLowerCase().replace(/\s+/g, " ");
      for (const [hn, v] of holdings) if (hn.replace(/\s+/g, " ") === k || hn.replace(/ kumar/g, "") === k.replace(/ kumar/g, "")) return v;
      return null;
    };
    set(
      "management",
      people.slice(0, 12).map((p) => {
        const yrs = isNum(p.years) ? p.years : Number(str(p.years).match(/\d+/)?.[0] ?? NaN);
        const hold = holdingOf(p.name);
        return { name: p.name, role: titleCase(p.role), years: Number.isFinite(yrs) ? String(yrs) : "", holding: hold != null ? fmt(hold, 2) : "" };
      }),
    );
    set("board_size", String(people.filter((p) => /director/i.test(p.role)).length || people.length));
    set("independent_directors", String(people.filter((p) => /independent/i.test(p.role)).length));
    if (keyPerson) {
      const k = keyPerson.toLowerCase().replace(/[^a-z]/g, "");
      const kp = people.find((p) => p.name.toLowerCase().replace(/[^a-z]/g, "") === k);
      set("contact_name", kp?.name ?? titleCase(keyPerson));
      if (kp) {
        if (kp.role) set("contact_role", titleCase(kp.role));
        if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(kp.email)) set("contact_email", kp.email.toLowerCase());
        const digits = kp.phone.replace(/\D/g, "");
        if (digits.length >= 10) set("contact_phone", digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : kp.phone);
      }
    }
  });

  if (keyPerson && !a.contact_name) set("contact_name", titleCase(keyPerson));

  // ---------- Systems ----------
  guard("the I.T. tab", () => {
    const rows = sheet(g, /^i\.?\s?t\.?$/i);
    if (!rows) return;
    const kv = pairs(rows);
    const lms = str(pick(kv, /loan management/));
    if (lms && !blank(lms)) set("lms", titleCase(lms));
    const mode = norm(pick(kv, /mode of collection/));
    const c = [
      /nach|mandate|ecs/.test(mode) && "nach_e_mandate",
      /cash/.test(mode) && "cash_at_branch_or_doorstep",
      /upi|digital|online|neft|imps/.test(mode) && "upi_or_other_digital",
      /cheque|pdc/.test(mode) && "post_dated_cheques",
    ].filter(Boolean);
    set("collections", c);
  });

  // ---------- Products and portfolio mix ----------
  guard("the product tabs", () => {
    const brief = sheet(g, /^products? brief/i);
    const products: { name: string; security: string; rate: string; states: string }[] = [];
    if (brief) {
      const h = findRow(brief, /loan product name/);
      const meth = findRow(brief, /lending methodology/);
      const sec = findRow(brief, /nature of security|collateral/);
      const rate = findRow(brief, /rate of interest range/);
      const st = findRow(brief, /states/);
      if (h >= 0 && meth >= 0) {
        for (let i = 1; i < brief[meth].length; i++) {
          const name = str(brief[meth][i]);
          if (!name) continue;
          products.push({ name, security: sec >= 0 ? str(brief[sec][i]) : "", rate: rate >= 0 ? str(brief[rate][i]) : "", states: st >= 0 ? str(brief[st][i]) : "" });
        }
      }
    }
    const dpdSheet = sheet(g, /product.?wise.*dpd/i);
    const book: { name: string; pos: number; buckets: number[] }[] = [];
    let bucketHeads: string[] = [];
    if (dpdSheet) {
      const h = findRow(dpdSheet, /loan product name/, 0, 4);
      if (h >= 0) {
        const head = dpdSheet[h];
        const nameCol = findCol(head, /loan product name/);
        const totalCol = findCol(head, /total pos/, nameCol);
        const loansCol = findCol(head, /active loans/, nameCol);
        const first = loansCol >= 0 ? loansCol + 1 : nameCol + 1;
        bucketHeads = head.slice(first, totalCol).map(norm);
        for (let i = h + 1; i < dpdSheet.length; i++) {
          const r = dpdSheet[i];
          const label = str(r[nameCol]) || str(r[nameCol - 1]);
          if (/grand total/i.test(label)) {
            book.push({ name: "__total__", pos: isNum(r[totalCol]) ? r[totalCol] : 0, buckets: r.slice(first, totalCol).map((c) => (isNum(c) ? c : 0)) });
            break;
          }
          if (!label || !isNum(r[totalCol]) || !(r[totalCol] as number)) continue;
          book.push({ name: label, pos: r[totalCol] as number, buckets: r.slice(first, totalCol).map((c) => (isNum(c) ? c : 0)) });
        }
      }
    }
    const total = book.find((b) => b.name === "__total__");
    const lines = book.filter((b) => b.name !== "__total__");
    const productFor = (n: string) => {
      const k = n.toLowerCase().replace(/[^a-z]/g, "");
      return products.find((p) => {
        const pk = p.name.toLowerCase().replace(/[^a-z]/g, "");
        return pk.startsWith(k) || k.startsWith(pk);
      });
    };
    const bySeg = new Map<string, { pos: number; rates: string[]; secured: Set<string>; names: string[] }>();
    const source = lines.length ? lines.map((l) => ({ name: l.name, pos: l.pos })) : products.map((p) => ({ name: p.name, pos: 0 }));
    for (const l of source) {
      const p = productFor(l.name);
      const { seg, secured } = segmentFor(p?.name ?? l.name, p?.security ?? "");
      const e = bySeg.get(seg) ?? { pos: 0, rates: [], secured: new Set<string>(), names: [] };
      e.pos += l.pos;
      if (p?.rate) e.rates.push(p.rate);
      e.secured.add(secured);
      e.names.push(p?.name ?? l.name);
      bySeg.set(seg, e);
    }
    if (bySeg.size) {
      set("segments", [...bySeg.keys()]);
      const sum = [...bySeg.values()].reduce((s, e) => s + e.pos, 0);
      const mix: Record<string, Record<string, string>> = {};
      for (const [seg, e] of bySeg) {
        const sec = e.secured.size > 1 ? "partly" : ([...e.secured][0] ?? "").toLowerCase();
        mix[seg] = {
          ...(sum > 0 ? { share: fmt((e.pos / sum) * 100, 1) } : {}),
          ...(e.rates.length ? { yield: [...new Set(e.rates)].join("; ").slice(0, 60) } : {}),
          ...(sec ? { secured: sec } : {}),
        };
      }
      set("segment_mix", mix);
      const other = bySeg.get("other");
      if (other) set("segment_other", other.names.join(", ").slice(0, 200));
    }
    if (total && total.pos > 0 && bucketHeads.length === total.buckets.length) {
      const share = (re: RegExp) => bucketHeads.reduce((s, hd, i) => (re.test(hd) ? s + total.buckets[i] : s), 0) / total.pos;
      const cur = share(/on time|current|^0 dpd/);
      const d1 = share(/(^|\D)1\s*-\s*30/);
      const d31 = share(/31\s*-\s*60/);
      const d61 = share(/61\s*-\s*90/);
      const d90 = 1 - cur - d1 - d31 - d61;
      set("dpd", {
        current: { pct: fmt(cur * 100, 1) },
        d1_30: { pct: fmt(d1 * 100, 1) },
        d31_60: { pct: fmt(d31 * 100, 1) },
        d61_90: { pct: fmt(d61 * 100, 1) },
        d90: { pct: fmt(Math.max(0, d90) * 100, 1) },
      });
    }
  });

  // ---------- Geography ----------
  guard("the state-wise portfolio", () => {
    const rows = sheet(g, /portfolio cuts dpd/i);
    if (!rows) return;
    const h = findRow(rows, /state wise/);
    if (h < 0) return;
    const totalCol = findCol(rows[h], /total pos/);
    const states: { value: string; pos: number }[] = [];
    for (let i = h + 1; i < rows.length && !/total/i.test(str(rows[i][0])); i++) {
      const name = str(rows[i][0]);
      const st = STATE_BY_NAME.get(name.toLowerCase());
      if (st && isNum(rows[i][totalCol])) states.push({ value: st, pos: rows[i][totalCol] as number });
    }
    if (!states.length) return;
    set("states_active", states.map((s) => s.value));
    const sum = states.reduce((s, x) => s + x.pos, 0);
    if (sum > 0) set("top_state_share", fmt((Math.max(...states.map((s) => s.pos)) / sum) * 100, 1));
  });

  // ---------- Borrowings ----------
  guard("the Debt Profile tab", () => {
    const rows = sheet(g, /^debt profile/i);
    if (!rows) return;
    const h = rows.findIndex((r) => r.some((c) => /name of (the )?(bank|lender)/.test(norm(c))));
    if (h < 0) return;
    const head = rows[h];
    const ci = {
      lender: findCol(head, /name of (the )?(bank|lender)/),
      type: findCol(head, /type of (loan|facility)/),
      sanctioned: findCol(head, /sanction(ed)? amount/),
      os: findCol(head, /o\/s|outstanding/),
      roi: findCol(head, /roi|rate of interest/),
      maturity: findCol(head, /maturity/),
    };
    const out: Record<string, string>[] = [];
    let os = 0;
    for (const r of rows.slice(h + 1)) {
      const lender = str(r[ci.lender]);
      if (!lender || /^total/i.test(lender)) continue;
      const o = isNum(r[ci.os]) ? (r[ci.os] as number) : null;
      if (o != null) os += o;
      const roi = isNum(r[ci.roi]) ? pct(r[ci.roi] as number) : null;
      out.push({
        lender: titleCase(lender).slice(0, 120),
        facility: facilityFor(ci.type >= 0 ? str(r[ci.type]) : ""),
        sanctioned: isNum(r[ci.sanctioned]) ? fmt(r[ci.sanctioned] as number) : "",
        outstanding: o != null ? fmt(o) : "",
        rate: roi != null ? fmt(roi) : "",
        cover: "",
        maturity: (ci.maturity >= 0 && isoDate(r[ci.maturity])) || "",
      });
    }
    if (out.length > 40) notes.push(`The debt profile lists ${out.length} facilities; the first 40 were carried over.`);
    set("lenders", out.slice(0, 40));
    if (os > 0) setFin("borrowings", "latest", os);
  });

  // ---------- Collection efficiency ----------
  guard("the collection efficiency tab", () => {
    const rows = sheet(g, /^cer|collection eff/i);
    const q = form.flatMap((s) => s.questions).find((x) => x.key === "collection_eff");
    if (!rows || !q || q.field.type !== "grid") return;
    const h = rows.findIndex((r) => r.some((c) => /^month$/.test(norm(c))) && r.some((c) => /current collection/.test(norm(c))));
    if (h < 0) return;
    const mc = findCol(rows[h], /^month$/);
    const cc = findCol(rows[h], /current collection/);
    const byMonth = new Map<number, number>();
    for (const r of rows.slice(h + 1)) {
      const m = monthOf(r[mc]);
      if (m && isNum(r[cc])) byMonth.set(ym(m), pct(r[cc] as number));
    }
    const grid: Record<string, Record<string, string>> = {};
    for (const row of q.field.rows) {
      const m = monthOf(row.label.replace(" ", "-"));
      const v = m ? byMonth.get(ym(m)) : undefined;
      if (v != null) grid[row.key] = { pct: fmt(v, 1) };
    }
    if (Object.keys(grid).length) set("collection_eff", grid);
  });

  // ---------- ALM and liquidity ----------
  guard("the ALM tab", () => {
    const rows = sheet(g, /^alm/i);
    if (!rows) return;
    const cum = findRow(rows, /cumulative mismatch/);
    const hdr = rows.findIndex((r) => r.some((c) => /6\s*m(onths?)?\s*to\s*1\s*year/.test(norm(c))));
    if (cum >= 0 && hdr >= 0) {
      const upTo = findCol(rows[hdr], /6\s*m(onths?)?\s*to\s*1\s*year/);
      const vals = rows[cum].slice(1, upTo + 1).filter(isNum);
      if (vals.length) set("alm_gap", vals.some((v) => v < 0) ? "yes" : "no");
    }
    // Liquidity: cash plus liquid investments, from the "Total" column. ALM sheets say lakh but are often in crore,
    // so the unit is checked against the loan book.
    const totalCol = rows.reduce((c, r) => (c >= 0 ? c : findCol(r, /^total$/)), -1);
    const cash = findRow(rows, /cash (balance|and bank)|bank balance/);
    // Investments kept as FLDG or under lien are collateral, not liquidity.
    const invRow = findRow(rows, /investments?/);
    const inv = invRow >= 0 && /fldg|lien|collateral|pledge/.test(rows[invRow].slice(0, 3).map(norm).join(" ")) ? -1 : invRow;
    const adv = findRow(rows, /advances|loan book|aum/);
    if (totalCol >= 0 && cash >= 0) {
      let liq = (isNum(rows[cash][totalCol]) ? (rows[cash][totalCol] as number) : 0) + (inv >= 0 && isNum(rows[inv][totalCol]) ? (rows[inv][totalCol] as number) : 0);
      const book = Number(fin.aum_on?.latest ?? NaN);
      const advT = adv >= 0 && isNum(rows[adv][totalCol]) ? (rows[adv][totalCol] as number) : NaN;
      if (Number.isFinite(book) && Number.isFinite(advT) && advT / book > 20) liq /= 100;
      else if (!Number.isFinite(book) || !Number.isFinite(advT) || advT / book < 0.5) liq = NaN; // unit unclear: leave blank
      if (Number.isFinite(liq) && liq > 0) set("liquidity", fmt(liq));
    }
  });

  // ---------- Partners and co-lending ----------
  guard("the partnership tabs", () => {
    const rows = sheet(g, /^securiti[sz]ation/i);
    if (!rows) return;
    const h = rows.findIndex((r) => r.some((c) => /name of investor/.test(norm(c))));
    if (h < 0) return;
    const nature = findCol(rows[h], /nature of facility/);
    const os = findCol(rows[h], /principal o\/s|outstanding/);
    const amt = findCol(rows[h], /amount securiti[sz]ed|assigned/);
    const parts: string[] = [];
    let coLending = false;
    for (const r of rows.slice(h + 1)) {
      const name = str(r[0]);
      if (!name) continue;
      const n = nature >= 0 ? str(r[nature]) : "";
      if (/co.?lend/i.test(n)) coLending = true;
      const val = [os, amt].map((c) => (c >= 0 && isNum(r[c]) ? (r[c] as number) : null)).find((v) => v != null);
      parts.push(`${titleCase(name)}${n ? ` (${n})` : ""}${val != null ? `, ₹${fmt(val)} Cr` : ""}`);
    }
    const orig = ["own_branches_and_staff", ...(coLending ? ["co_lending_with_banks_or_nbfcs"] : [])];
    set("origination", orig);
    if (parts.length && coLending) set("partner_sourcing", `From the data sheet: ${parts.join("; ")}.`.slice(0, 1000));
  });

  if (Object.keys(fin).length) {
    a.fin = fin;
    filled.add("fin");
  }
  return { answers: a, filled: [...filled], notes };
}

const isBlankAnswer = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Imported answers fill blanks only: anything already typed into the form is kept, cell by cell for grids. */
export function mergeAnswers(existing: Answers, imported: Answers): Answers {
  const out: Answers = { ...existing };
  for (const [k, v] of Object.entries(imported)) {
    const cur = out[k];
    if (isBlankAnswer(cur)) out[k] = v;
    else if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) {
      const merged: Record<string, unknown> = { ...(cur as Record<string, unknown>) };
      for (const [rk, rv] of Object.entries(v as Record<string, unknown>)) {
        const c = merged[rk];
        if (isBlankAnswer(c)) merged[rk] = rv;
        else if (rv && typeof rv === "object" && c && typeof c === "object") {
          const cell = { ...(c as Record<string, unknown>) };
          for (const [ck, cv] of Object.entries(rv as Record<string, unknown>)) if (isBlankAnswer(cell[ck])) cell[ck] = cv;
          merged[rk] = cell;
        }
      }
      out[k] = merged;
    }
  }
  return out;
}
