import "server-only";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb } from "@/lib/db";
import type * as schema from "./schema";

/*
 * The private-credit console's only door to the database (MODEL.md, "Private credit").
 *
 * Every query runs inside withContext(), in a transaction that first drops to the restricted role `credit_app`
 * (no BYPASSRLS, not the owner of anything) and pins the row-level-security context. The credit_* tables have
 * FORCE ROW LEVEL SECURITY and policies keyed on that context (drizzle/0050_private_credit.sql), so a lender only
 * ever reads its own rows even if a query in the code forgets a filter. The rest of Before the Bell never reads
 * the credit_* tables.
 */

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export type DbContext =
  | { role: "admin"; userId: string }
  | { role: "lender"; userId: string; lenderId: string }
  | { role: "partner"; userId: string; partnerId: string }
  /** The public borrower form: tokenHash identifies the one form this request may touch. */
  | { role: "applicant"; tokenHash: string }
  /** A signed-in applicant (account made when they started a form on the website): sees forms filed under their email. */
  | { role: "applicant_account"; userId: string; email: string }
  | { role: "auth" }
  | { role: "intake" }
  | { role: "outreach" };

export async function withContext<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (raw) => {
    const tx = raw as unknown as Tx;
    const lenderId = ctx.role === "lender" ? ctx.lenderId : "";
    const partnerId = ctx.role === "partner" ? ctx.partnerId : "";
    const applyToken = ctx.role === "applicant" ? ctx.tokenHash : "";
    const userEmail = ctx.role === "applicant_account" ? ctx.email.toLowerCase() : "";
    const userId = ctx.role === "admin" || ctx.role === "lender" || ctx.role === "partner" || ctx.role === "applicant_account" ? ctx.userId : "";
    await tx.execute(sql`set local role credit_app`);
    await tx.execute(
      sql`select set_config('app.role', ${ctx.role}, true), set_config('app.lender_id', ${lenderId}, true), set_config('app.partner_id', ${partnerId}, true), set_config('app.apply_token', ${applyToken}, true), set_config('app.user_email', ${userEmail}, true), set_config('app.user_id', ${userId}, true)`,
    );
    return fn(tx);
  });
}
