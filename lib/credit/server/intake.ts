import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withContext } from "@/lib/credit/db";
import { accessRequests } from "@/lib/credit/schema";

/*
 * Write-only intake for "request access" submissions from the public site.
 * The intake DB context can insert access requests and nothing else: it cannot read any table.
 */

export const accessRequestSchema = z.object({
  side: z.enum(["borrower", "lender"]),
  name: z.string().trim().min(1).max(200),
  organisation: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot: must stay empty
  consent: z.literal("yes"),
  /** Version of the privacy notice shown next to the consent box. */
  noticeVersion: z.string().trim().min(1).max(40),
});

const REQUESTS_PER_IP_PER_HOUR = 5;

export async function submitAccessRequest(input: unknown, ip: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = accessRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form fields." };
  const { website, consent: _consent, noticeVersion, ...v } = parsed.data;
  void _consent;
  if (website) return { ok: true }; // silently drop bots
  const limited = await withContext({ role: "intake" }, async (tx) => {
    if (ip) {
      // The intake role can't read access requests; this function returns only a count for one IP.
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const res = await tx.execute(sql`select credit_intake_recent_count(${ip}, ${since}::timestamptz) as n`);
      if (Number((res.rows[0] as { n: number }).n) >= REQUESTS_PER_IP_PER_HOUR) return true;
    }
    await tx.insert(accessRequests).values({
      ...v,
      phone: v.phone || null,
      message: v.message || null,
      ip,
      consentNoticeVersion: noticeVersion,
      consentedAt: new Date(),
    });
    return false;
  });
  if (limited) return { ok: false, error: "Too many requests from your network. Please try again later." };
  return { ok: true };
}
