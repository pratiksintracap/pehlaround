// The one rule for listed companies (After the Bell): they are desk-only and never reach an investor-facing surface.
// Every investor-facing read of the deals table filters with `notListed` (SQL) or `investorVisible` (in memory).
// tests/listed-guard.test.ts fails the build if an investor-side file queries deals without it; a database check
// (deals_listed_desk_only) also keeps a listed deal unpublished, closed and out of "coming to the desk".
// No "server-only" here so the tests can import it.
import { and, eq, type SQL } from "drizzle-orm";
import { deals } from "@/db/schema";

export const notListed: SQL = eq(deals.listed, false);
/** `where` for an investor-facing deals query: the listed guard plus any other conditions. */
export const investorWhere = (...c: (SQL | undefined)[]) => and(notListed, ...c);
export const investorVisible = <T extends { listed?: boolean | null }>(d: T | null | undefined): d is T => !!d && !d.listed;
