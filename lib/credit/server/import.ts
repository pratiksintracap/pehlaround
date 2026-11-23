import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { openForSite } from "@/lib/agent-exchange";
import { putObjectAt } from "./storage";

/*
 * The one-off move of NBFC Desk's data into the credit_* tables (MODEL.md, "Private credit"). NBFC Desk serves its
 * rows and files sealed to this site's key (its /api/migrate/export); this pulls them, opens them and writes them
 * with the same ids, so every reference keeps working. It is resumable: each call does as much as fits in its time
 * budget and reports where it stands; calling again carries on. Rows already present are skipped.
 * Run from the desk assistant (agent action "credit_import").
 */

const SOURCE = process.env.CREDIT_IMPORT_SOURCE ?? "https://app.nbfcdesk.com/api/migrate/export";

async function pull(params: Record<string, string>): Promise<Buffer> {
  const r = await fetch(`${SOURCE}?${new URLSearchParams(params)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`NBFC Desk answered ${r.status} for ${params.step}`);
  return openForSite(Buffer.from(await r.arrayBuffer()));
}
const pullJson = async <T>(params: Record<string, string>) => JSON.parse((await pull(params)).toString("utf8")) as T;

type Manifest = { at: string; tables: Record<string, number>; unreadable?: Record<string, string>; files: string[]; error?: string };
type Page = { table: string; offset: number; rows: Record<string, unknown>[]; next: number; error?: string };
type Rows = { rows?: Record<string, unknown>[] } | Record<string, unknown>[];
const rowsOf = (r: unknown) => (Array.isArray(r) ? r : ((r as { rows?: Record<string, unknown>[] }).rows ?? [])) as Record<string, unknown>[];

/** credit_ tables in an order where every table comes after the tables it references. */
async function insertOrder(): Promise<string[]> {
  const db = await getDb();
  const tables = rowsOf(await db.execute(sql`select tablename as t from pg_tables where schemaname = 'public' and tablename like 'credit\_%'`)).map((r) => String(r.t));
  const edges = rowsOf(await db.execute(sql`
    select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent from pg_constraint c
    where c.contype = 'f' and c.conrelid::regclass::text like 'credit\_%'`));
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const e of edges) if (e.child !== e.parent) deps.get(String(e.child))?.add(String(e.parent).replace(/^public\./, "").replace(/"/g, ""));
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (t: string, path: Set<string>) => {
    if (seen.has(t) || path.has(t)) return;
    path.add(t);
    for (const p of deps.get(t) ?? []) visit(p, path);
    path.delete(t);
    seen.add(t);
    out.push(t);
  };
  for (const t of tables.sort()) visit(t, new Set());
  return out;
}

async function count(table: string): Promise<number> {
  const db = await getDb();
  return Number(rowsOf(await db.execute(sql.raw(`select count(*)::int as n from "${table}"`)))[0]?.n ?? 0);
}

export async function creditImport(budgetMs = 45_000) {
  const until = Date.now() + budgetMs;
  const db = await getDb();
  const m = await pullJson<Manifest>({ step: "manifest" });
  if (m.error) throw new Error(`NBFC Desk: ${m.error}`);
  const order = (await insertOrder()).filter((t) => t.slice("credit_".length) in m.tables);
  const report: Record<string, [number, number]> = {};
  let busy = false;

  for (const t of order) {
    const src = t.slice("credit_".length);
    const total = m.tables[src];
    let have = await count(t);
    let offset = 0;
    while (have < total && Date.now() < until) {
      const page = await pullJson<Page>({ step: "rows", table: src, offset: String(offset) });
      if (page.error) throw new Error(`NBFC Desk (${src}): ${page.error}`);
      if (!page.rows.length) break;
      if (src === "users") {
        // A platform admin made here before the move (by signing in with the site) would clash with their old account
        // by email: the old account wins. The new one is set aside (email renamed, disabled) so anything it already
        // touched still points somewhere.
        const emails = page.rows.map((r) => String(r.email).toLowerCase());
        const ids = page.rows.map((r) => String(r.id));
        await db.execute(sql`update credit_users set email = email || '.premove-' || left(id::text, 8), disabled_at = now()
          where lower(email) = any(${sql.raw(`array[${emails.map((e) => `'${e.replace(/'/g, "''")}'`).join(",") || "''"}]::text[]`)})
          and not (id::text = any(${sql.raw(`array[${ids.map((e) => `'${e.replace(/'/g, "''")}'`).join(",") || "''"}]::text[]`)}))`);
      }
      await db.execute(sql`insert into ${sql.raw(`"${t}"`)} select * from json_populate_recordset(null::${sql.raw(`"${t}"`)}, ${JSON.stringify(page.rows)}::json) on conflict do nothing`);
      offset = page.next;
      have = await count(t);
      if (offset >= total) break;
    }
    if (have < total) busy = true;
    report[t] = [have, total];
    if (Date.now() >= until) { busy = true; break; }
  }
  // bigserial ids came across as they were: move the sequences past them.
  for (const s of rowsOf(await db.execute(sql`
    select c.relname as seq, d.refobjid::regclass::text as tbl, a.attname as col from pg_class c
    join pg_depend d on d.objid = c.oid and d.deptype = 'a' join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
    where c.relkind = 'S' and c.relname like 'credit\_%'`))) {
    await db.execute(sql.raw(`select setval('"${s.seq}"', greatest((select coalesce(max("${s.col}"), 0) from ${s.tbl}), 1))`));
  }

  let filesHave = 0;
  const present = new Set(rowsOf(await db.execute(sql`select key from credit_blobs`)).map((r) => String(r.key)));
  for (const key of m.files) {
    if (present.has(key)) { filesHave++; continue; }
    if (Date.now() >= until) { busy = true; continue; }
    await putObjectAt(key, await pull({ step: "file", key }));
    filesHave++;
  }
  const missing = Object.keys(m.tables).filter((t) => !order.includes(`credit_${t}`));
  return { ok: true, done: !busy && filesHave === m.files.length, sourceAt: m.at, tables: report, files: [filesHave, m.files.length], unreadable: m.unreadable ?? {}, notHere: missing };
}
