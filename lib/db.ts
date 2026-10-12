import "server-only";
import path from "node:path";
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
      // Several serverless instances can cold-start together; one migrates and seeds at a time.
      const lock = await pool.connect();
      try {
        await lock.query("select pg_advisory_lock(7262001)");
        await migrate(db, { migrationsFolder: MIGRATIONS });
        await bootstrap(db);
      } finally {
        await lock.query("select pg_advisory_unlock(7262001)").catch(() => {});
        lock.release();
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

async function bootstrap(db: DB) {
  // Seed the deals once.
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.deals);
  if (!n) {
    for (const d of SEED_DEALS) {
      const { documents: docs, questions: qs, sessions, ...deal } = d;
      const [row] = await db.insert(schema.deals).values(deal).returning({ id: schema.deals.id });
      let i = 0;
      for (const doc of docs) await db.insert(schema.documents).values({ ...doc, dealId: row.id, sort: i++ });
      for (const q of qs) await db.insert(schema.questions).values({ dealId: row.id, question: q.q, answer: q.a ?? null, answeredBy: q.by ?? null,
        askedAt: new Date(q.asked), answeredAt: q.answered ? new Date(q.answered) : null });
      for (const c of sessions) await db.insert(schema.calls).values({ dealId: row.id, kind: "session", title: c.title, status: c.status, scheduledFor: c.when, summary: c.summary ?? null });
    }
  }
  const [{ a }] = await db.select({ a: sql<number>`count(*)::int` }).from(schema.articles);
  if (!a) for (const x of SEED_ARTICLES) await db.insert(schema.articles).values({ ...x, publishedAt: new Date(x.publishedAt) });
  // The admin account comes from the environment, so no password is ever in the code.
  const email = (process.env.ADMIN_EMAIL || (process.env.NODE_ENV !== "production" ? "admin@pehlaround.in" : "")).toLowerCase().trim();
  const pass = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "pehla-local-admin" : "");
  if (email && pass) {
    const existing = await db.select({ id: schema.users.id, role: schema.users.role }).from(schema.users).where(eq(schema.users.email, email));
    if (!existing.length) {
      await db.insert(schema.users).values({ email, name: process.env.ADMIN_NAME || "Desk admin", role: "admin", passwordHash: await bcrypt.hash(pass, 10) });
    } else if (existing[0].role !== "admin") {
      await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existing[0].id));
    }
  }
}
