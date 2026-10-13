import "server-only";
import path from "node:path";
import fs from "node:fs";
import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import * as schema from "@/db/schema";
import { SEED_DEALS } from "@/lib/seed";
import { SEED_ARTICLES } from "@/lib/seed-articles";

export type DB = NodePgDatabase<typeof schema>;
type State = { db: DB; ready: Promise<void>; kind: "postgres" | "pglite" };
const g = globalThis as unknown as { __pr_db?: State };

const MIGRATIONS = path.join(process.cwd(), "drizzle");
/** How many migrations this build ships (from drizzle's journal). */
function journalCount() {
  try { return (JSON.parse(fs.readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8")).entries as unknown[]).length; } catch { return 0; }
}

/** True when the site is running on a real Postgres (Neon) database. */
export function dbKind() { return connect().kind; }

function connect(): State {
  if (g.__pr_db) return g.__pr_db;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let state: State;
  if (url) {
    // Neon / any Postgres. node-postgres works in Vercel's Node runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
    const db = drizzle(pool, { schema });
    state = { db, kind: "postgres", ready: Promise.resolve() };
    state.ready = (async () => {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      // Fast path: every migration shipped with this build is already applied, so no lock is needed.
      const shipped = journalCount();
      const applied = await pool.query("select count(*)::int as n from drizzle.__drizzle_migrations").then((r) => Number(r.rows[0]?.n ?? 0)).catch(() => 0);
      if (shipped && applied >= shipped) { await bootstrap(db).catch((e) => console.error("bootstrap", e)); return; }
      // Otherwise one instance migrates at a time. The lock lives on a direct (unpooled) connection: through the pooler a
      // session lock can be taken on one server connection and never released, which once hung every cold start.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Client } = require("pg") as typeof import("pg");
      const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || url;
      const lock = new Client({ connectionString: direct, ssl: /localhost|127\.0\.0\.1/.test(direct) ? undefined : { rejectUnauthorized: false } });
      await lock.connect();
      try {
        let got = false;
        for (let i = 0; i < 40 && !got; i++) { // up to ~20 s, then go ahead anyway: a held lock may be orphaned
          got = (await lock.query("select pg_try_advisory_lock(7262002) as ok")).rows[0]?.ok === true;
          if (!got) await new Promise((r) => setTimeout(r, 500));
        }
        await migrate(db, { migrationsFolder: MIGRATIONS });
        await bootstrap(db);
      } finally {
        await lock.end().catch(() => {}); // closing the session always releases the lock
      }
    })();
  } else {
    // No database configured: an embedded Postgres (PGlite). Local development, or a first deploy
    // before the database is attached. On Vercel this lives in /tmp and does not persist.
    const dir = process.env.PGLITE_DIR || (process.env.VERCEL ? "/tmp/pglite" : path.join(process.cwd(), ".pglite"));
    let db!: DB;
    state = { db: undefined as unknown as DB, kind: "pglite", ready: Promise.resolve() };
    state.ready = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const client = new PGlite(dir);
      db = drizzle(client, { schema }) as unknown as DB;
      state.db = db;
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(db as never, { migrationsFolder: MIGRATIONS });
      await bootstrap(db);
    })();
  }
  g.__pr_db = state;
  return state;
}

export async function getDb(): Promise<DB> {
  const s = connect();
  try { await s.ready; } catch (e) { g.__pr_db = undefined; throw e; }
  return s.db;
}

// Starting Desk Scores (out of 10); the desk changes them in Admin → Deals.
const SCORES: Record<string, number> = { "naval-defence-secondary": 8.6, "jewellery-pre-ipo": 8.3, "ai-collections-software": 8.1,
  "waste-management-growth-round": 7.9, "edible-oils-pre-ipo": 7.7, "ethanol-distillery-pre-ipo": 7.5 };

async function bootstrap(db: DB) {
  // Seed the deals once.
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.deals);
  if (!n) {
    for (const d of SEED_DEALS) {
      const { documents: docs, questions: qs, sessions, ...deal } = d;
      const [row] = await db.insert(schema.deals).values({ ...deal, score: deal.score ?? SCORES[deal.slug] ?? null }).returning({ id: schema.deals.id });
      let i = 0;
      for (const doc of docs) await db.insert(schema.documents).values({ ...doc, dealId: row.id, sort: i++ });
      for (const q of qs) await db.insert(schema.questions).values({ dealId: row.id, question: q.q, answer: q.a ?? null, answeredBy: q.by ?? null,
        askedAt: new Date(q.asked), answeredAt: q.answered ? new Date(q.answered) : null });
      for (const c of sessions) await db.insert(schema.calls).values({ dealId: row.id, kind: "session", title: c.title, status: c.status, scheduledFor: c.when, summary: c.summary ?? null });
    }
  }
  // Articles shipped with the code are added once each (by slug); one the desk deletes later stays deleted.
  const [mark] = await db.select().from(schema.settings).where(eq(schema.settings.key, "seeded_articles"));
  const done = new Set<string>(mark ? JSON.parse(mark.value) : []);
  const have = new Set((await db.select({ slug: schema.articles.slug }).from(schema.articles)).map((r) => r.slug));
  for (const x of SEED_ARTICLES) if (!done.has(x.slug) && !have.has(x.slug)) await db.insert(schema.articles).values({ ...x, publishedAt: new Date(x.publishedAt) });
  const all = JSON.stringify(SEED_ARTICLES.map((x) => x.slug));
  if (!mark) await db.insert(schema.settings).values({ key: "seeded_articles", value: all }).onConflictDoNothing();
  else if (mark.value !== all) await db.update(schema.settings).set({ value: JSON.stringify([...new Set([...done, ...SEED_ARTICLES.map((x) => x.slug)])]) }).where(eq(schema.settings.key, "seeded_articles"));
  // The admin account comes from the environment, so no password is ever in the code.
  const email = (process.env.ADMIN_EMAIL || (process.env.NODE_ENV !== "production" ? "admin@offmarketdesk.in" : "")).toLowerCase().trim();
  const pass = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "omd-local-admin" : "");
  if (email && pass) {
    const existing = await db.select({ id: schema.users.id, role: schema.users.role }).from(schema.users).where(eq(schema.users.email, email));
    if (!existing.length) {
      await db.insert(schema.users).values({ email, name: process.env.ADMIN_NAME || "Desk admin", role: "admin", passwordHash: await bcrypt.hash(pass, 10) });
    } else if (existing[0].role !== "admin") {
      await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existing[0].id));
    }
  }
}
