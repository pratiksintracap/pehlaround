import "server-only";
import { E, emailReady, esc, layout, sendRaw } from "@/lib/email";

/**
 * Outgoing mail for the private-credit console (sign-in codes and notifications; never deal details).
 * Sent through Before the Bell's own mail (Resend, from desk@beforethebell.in) in the house layout.
 * Without RESEND_API_KEY (development, tests) the message is logged instead.
 */

export type MailOptions = {
  /** A ready HTML body (outreach emails); otherwise the text body is laid out as paragraphs. */
  html?: string;
  /** Kept for callers from the old console; the sender is always the desk address. */
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
};

const CREDIT_FOOTER =
  "Sent by the Private Credit desk of Before the Bell, operated by SintraCap Advisors LLP, Lower Parel, Mumbai. Nothing in this email is an offer or advice.";

export function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((para) => E.p(esc(para).replace(/\n/g, "<br>")))
    .join("");
}

export async function sendMail(to: string, subject: string, text: string, opts: MailOptions = {}) {
  if (!emailReady()) {
    if (process.env.NODE_ENV === "production") console.error("[credit mail] RESEND_API_KEY not set; not sent:", subject);
    else console.log("[credit mail]", JSON.stringify({ to, subject, text }));
    return;
  }
  const html = opts.html ?? layout(textToHtml(text), { footer: CREDIT_FOOTER });
  const sent = await sendRaw([to], subject, html, [], opts.replyTo, { kind: "credit" });
  if (!sent) throw new Error("Email could not be sent");
}
