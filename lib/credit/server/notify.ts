import "server-only";
import { SITE_URL } from "@/lib/site";
import { and, eq, isNull } from "drizzle-orm";
import { withContext } from "@/lib/credit/db";
import { users } from "@/lib/credit/schema";
import { sendMail } from "./mailer";
import { BRAND_NAME } from "@/lib/credit/brand";

/*
 * Email nudges. They never contain deal details (no borrower names, amounts, rates or messages):
 * email is not behind sign-in, so it only says that something is waiting and links to the dashboard.
 * Failures are logged and never block the action that triggered them.
 */

function appUrl(path: string) {
  return `${SITE_URL}${path}`;
}

async function recipients(filter: { lenderId: string } | { admins: true }) {
  // System lookup of active users' emails; runs in the auth context, which can read users only.
  return withContext({ role: "auth" }, (tx) =>
    tx
      .select({ email: users.email })
      .from(users)
      .where(
        "admins" in filter
          ? and(eq(users.role, "platform_admin"), isNull(users.disabledAt))
          : and(eq(users.lenderId, filter.lenderId), isNull(users.disabledAt)),
      ),
  );
}

async function send(to: { email: string }[], subject: string, text: string) {
  for (const r of to) {
    try {
      await sendMail(r.email, subject, text);
    } catch (e) {
      console.error("[notify] could not send", subject, (e as Error).message);
    }
  }
}

export async function notifyLenderOfShare(lenderId: string) {
  try {
    await send(
      await recipients({ lenderId }),
      `${BRAND_NAME}: a new raise has been shared with you`,
      `A new raise has been shared with your team on ${BRAND_NAME}.\n\nSign in to review it: ${appUrl("/credit/lender")}`,
    );
  } catch (e) {
    console.error("[notify] share", (e as Error).message);
  }
}

export async function notifyLenderOfReply(lenderId: string, raiseId: string) {
  try {
    await send(
      await recipients({ lenderId }),
      `${BRAND_NAME}: new message from the platform team`,
      `The platform team has replied on one of your raises.\n\nSign in to read it: ${appUrl(`/credit/lender/deals/${raiseId}`)}`,
    );
  } catch (e) {
    console.error("[notify] reply", (e as Error).message);
  }
}

export async function notifyAdminsOfLenderMessage(raiseId: string) {
  try {
    await send(
      await recipients({ admins: true }),
      `${BRAND_NAME}: new lender question`,
      `A lender has posted a question on a raise.\n\nSign in to reply: ${appUrl(`/credit/admin/raises/${raiseId}`)}`,
    );
  } catch (e) {
    console.error("[notify] lender message", (e as Error).message);
  }
}

export async function notifyAdminsOfSubmission(submissionId: string) {
  try {
    await send(
      await recipients({ admins: true }),
      `${BRAND_NAME}: a partner has sent a borrower's information`,
      `A partner has sent a borrower NBFC's information for review.\n\nSign in to see it: ${appUrl(`/credit/admin/submissions/${submissionId}`)}`,
    );
  } catch (e) {
    console.error("[notify] submission", (e as Error).message);
  }
}

export async function notifyPartnerOfRequest(partnerId: string, submissionId: string) {
  try {
    const to = await withContext({ role: "auth" }, (tx) =>
      tx.select({ email: users.email }).from(users).where(and(eq(users.partnerId, partnerId), isNull(users.disabledAt))),
    );
    await send(
      to,
      `${BRAND_NAME}: more information requested`,
      `The Before the Bell team has asked for more information on one of the companies you sent.\n\nSign in to see what's needed: ${appUrl(`/credit/partner/submissions/${submissionId}`)}`,
    );
  } catch (e) {
    console.error("[notify] partner request", (e as Error).message);
  }
}

/** Public-site applicants: the link is their only way back in, so the email carries it. No details of the form. */
export async function notifyApplicantOfRequest(email: string, token: string) {
  await send(
    [{ email }],
    `${BRAND_NAME}: more information requested`,
    `The Before the Bell team has asked for more information on the borrower form you sent.\n\nOpen your form to see what's needed: ${appUrl(`/credit/apply/${token}`)}\n\nKeep this link private: anyone with it can open the form.`,
  );
}

export async function sendApplicationLink(email: string, name: string, company: string, token: string) {
  await send(
    [{ email }],
    `${BRAND_NAME}: your borrower form for ${company}`,
    `Dear ${name},\n\nThank you for starting the Before the Bell borrower form for ${company}. Your answers save as you go; use this link to come back to it at any time, on any device:\n\n${appUrl(`/credit/apply/${token}`)}\n\nKeep this link private: anyone with it can open the form.\n\nWe've also set up your Before the Bell account with this email. To see your forms later, sign in at ${appUrl("/credit/login")} with this email address; we'll send you a one-time code.\n\nBefore the Bell`,
  );
}

/** A new borrower form was started on the website: a lead for the team. No details in the email. */
export async function notifyAdminsOfWebsiteStart(company: string) {
  try {
    void company;
    await send(
      await recipients({ admins: true }),
      `${BRAND_NAME}: new borrower form started on the website`,
      `Someone has started a borrower form on the website. Their contact details are in Submissions, under "Started on the website":\n\n${appUrl("/credit/admin/submissions?status=draft")}`,
    );
  } catch (e) {
    console.error("[notify] website start", (e as Error).message);
  }
}
