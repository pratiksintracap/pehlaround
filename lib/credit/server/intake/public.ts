import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withContext } from "@/lib/credit/db";
import { intakeSubmissions } from "@/lib/credit/schema";
import { logActivity } from "../activity";
import { encrypt, keyedHash, newSessionToken } from "../crypto";
import { notifyAdminsOfWebsiteStart, sendApplicationLink } from "../notify";
import { CIN_RE, answersFromRegistry } from "@/lib/credit/intake/definition";
import type { Applicant } from "./partner";

/*
 * The borrower form on the public website, with no account. Starting a form creates it and returns a private
 * link (a random token; only its hash is stored, plus an encrypted copy for re-sending). Every later request
 * carries the token and runs in the 'applicant' database context, which row-level security limits to that one
 * form and its files.
 */

export const startSchema = z.object({
  role: z.enum(["company", "agent"]),
  name: z.string().trim().min(1, "Enter your name").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  phone: z.string().trim().min(6, "Enter a phone number").max(40),
  agentFirm: z.string().trim().max(200).optional().or(z.literal("")),
  companyName: z.string().trim().min(2, "Enter the NBFC's name").max(200),
  cin: z.string().trim().toUpperCase().max(30).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot: stays empty for people
  consent: z.literal("yes", { message: "Please agree to the privacy notice to continue" }),
  noticeVersion: z.string().trim().min(1).max(40),
});

const NEW_FORMS_PER_IP_PER_HOUR = 5;

export function tokenHashOf(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return keyedHash(`apply:${token}`);
}

export function applicantFor(token: string): Applicant | null {
  const h = tokenHashOf(token);
  return h ? { kind: "applicant", tokenHash: h } : null;
}

export type StartResult = { ok: true; token: string } | { ok: false; error: string };

export async function startApplication(input: unknown, ip: string | null): Promise<StartResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;
  if (v.website) return { ok: false, error: "Please check the form." }; // bots
  if (v.role === "agent" && !v.agentFirm) return { ok: false, error: "Enter your firm's name" };
  if (v.cin && !CIN_RE.test(v.cin)) return { ok: false, error: "The CIN doesn't look right (21 characters, e.g. U65999MH2010PTC000000)" };
  // Fill what RBI's register knows: by CIN, or by an exact name match.
  const reg = (await registryLookup(v.cin || v.companyName)).find((r) => (v.cin ? r.cin === v.cin : r.name.toLowerCase() === v.companyName.toLowerCase()));
  const regAnswers = reg ? answersFromRegistry({ state: reg.state, type: reg.classification, layer: reg.layer, rbiRegNo: reg.rbi_reg_no }) : {};
  const cin = v.cin || reg?.cin || "";
  const token = newSessionToken();
  const tokenHash = tokenHashOf(token)!;
  const limited = await withContext({ role: "applicant", tokenHash }, async (tx) => {
    if (ip) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const res = await tx.execute(sql`select credit_apply_recent_count(${ip}, ${since}::timestamptz) as n`);
      if (Number((res.rows[0] as { n: number }).n) >= NEW_FORMS_PER_IP_PER_HOUR) return true;
    }
    const [row] = await tx
      .insert(intakeSubmissions)
      .values({
        source: "public",
        submitterRole: v.role,
        submitterName: v.name,
        submitterEmail: v.email,
        submitterPhone: v.phone,
        agentFirm: v.role === "agent" ? v.agentFirm || null : null,
        accessTokenHash: tokenHash,
        accessTokenEnc: encrypt(token),
        ip,
        consentNoticeVersion: v.noticeVersion,
        consentedAt: new Date(),
        companyName: v.companyName,
        cin: cin || null,
        answers: { legal_name: v.companyName, ...(cin ? { cin } : {}), ...regAnswers },
      })
      .returning({ id: intakeSubmissions.id });
    // Their account: they can sign in later with an emailed code and find this form under "Your forms".
    // In a savepoint: if the account can't be made (e.g. the database update hasn't run yet), the form still starts.
    await tx
      .transaction((sp) => sp.execute(sql`select credit_applicant_signup(${v.email}, ${v.name})`))
      .catch((e) => console.error("[apply] account not created", e instanceof Error ? e.message : e));
    await logActivity(tx, { kind: "system", role: "applicant", userId: null }, "intake.public_started", "intake_submission", row.id, {
      companyName: v.companyName,
      role: v.role,
    });
    return false;
  });
  if (limited) return { ok: false, error: "Too many new forms from your network in the last hour. Please try again later." };
  await sendApplicationLink(v.email, v.name, v.companyName, token);
  await notifyAdminsOfWebsiteStart(v.companyName);
  return { ok: true, token };
}

/** RBI register look-up for auto-filling a company's details from its CIN or name. Public data only. */
export async function registryLookup(q: string) {
  const t = String(q ?? "").trim().slice(0, 100);
  if (t.length < 3) return [];
  return withContext({ role: "applicant", tokenHash: "lookup" }, async (tx) => {
    const res = await tx.execute(sql`select * from credit_registry_lookup(${t})`);
    return res.rows as { name: string; cin: string | null; rbi_reg_no: string | null; state: string | null; regional_office: string | null; classification: string | null; layer: string | null }[];
  });
}


/** A signed-in applicant's forms (row-level security limits the query to forms filed under their email). */
export async function listMyForms(actor: import("../actors").ApplicantUserActor) {
  const { decrypt } = await import("../crypto");
  const { desc } = await import("drizzle-orm");
  return withContext({ role: "applicant_account", userId: actor.userId, email: actor.email }, async (tx) => {
    const rows = await tx.select().from(intakeSubmissions).orderBy(desc(intakeSubmissions.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      status: r.status,
      updatedAt: r.updatedAt,
      submittedAt: r.submittedAt,
      token: r.accessTokenEnc ? decrypt(r.accessTokenEnc) : null,
    }));
  });
}
