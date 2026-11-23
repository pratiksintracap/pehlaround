/**
 * Outreach emails are written as plain text (with {{placeholders}} filled per NBFC), then sent as HTML with a
 * plain-text alternative. URLs and email addresses become proper links, and a signature with linked website and
 * reply address is added, plus an opt-out line.
 */

export type OutreachTemplate = { subject: string; body: string };

export const PLACEHOLDERS = ["{{company}}", "{{contact_name}}", "{{sender_name}}"] as const;

/** Starting draft. Must be reviewed and saved by the team before the first send. */
export const OUTREACH_DEFAULT: OutreachTemplate = {
  subject: "Secured funding for {{company}}, on your own cycle",
  body: [
    "Dear {{contact_name}},",
    "",
    "I'm writing from Before the Bell, a platform for secured NBFC-to-NBFC lending in India.",
    "",
    "You bring one funding proposal. We run the platform's diligence, match the raise to larger NBFCs whose thesis, rate band and risk appetite it fits, and can sell it down across several of them at parity: the same security, terms and rate for each lender.",
    "",
    "Drawdowns recur on the cycle that suits your book: monthly, quarterly or yearly. Your company diligence is held online, so it isn't rebuilt for every lender or every drawdown.",
    "",
    "If {{company}} is looking to raise secured funding, I'd be glad to set up a short call. You can see how it works at https://beforethebell.in/private-credit/how-it-works",
    "",
    "Regards,",
    "{{sender_name}}",
  ].join("\n"),
};

export function fillTemplate(t: OutreachTemplate, v: { company: string; contactName?: string | null; senderName: string }): OutreachTemplate {
  const fill = (s: string) =>
    s
      .replace(/\{\{\s*company\s*\}\}/g, v.company)
      .replace(/\{\{\s*contact_name\s*\}\}/g, v.contactName?.trim() || "Sir / Madam")
      .replace(/\{\{\s*sender_name\s*\}\}/g, v.senderName);
  return { subject: fill(t.subject), body: fill(t.body) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function linkify(escaped: string): string {
  return escaped
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:#14302e">${u.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>`)
    .replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (_m, pre, e) => `${pre}<a href="mailto:${e}" style="color:#14302e">${e}</a>`);
}

export const OPT_OUT_TEXT = "If you'd rather not hear from us, reply to this email and we won't write again.";

export function renderOutreach(bodyText: string, s: { senderName: string; replyTo: string }) {
  const site = "https://beforethebell.in";
  const text = `${bodyText.trim()}\n\n--\n${s.senderName}\nBefore the Bell\n${site}\n${s.replyTo}\n\n${OPT_OUT_TEXT}\n`;
  const paras = bodyText
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkify(esc(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a2422;max-width:620px">` +
    paras +
    `<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #d6dbd4;font-size:13px;color:#55625e">` +
    `<strong style="color:#1a2422">${esc(s.senderName)}</strong><br>Before the Bell<br>` +
    `<a href="${site}" style="color:#14302e">beforethebell.in</a><br>` +
    `<a href="mailto:${esc(s.replyTo)}" style="color:#14302e">${esc(s.replyTo)}</a></p>` +
    `<p style="margin:16px 0 0;font-size:12px;color:#8a948f">${esc(OPT_OUT_TEXT)}</p>` +
    `</div>`;
  return { text, html };
}
