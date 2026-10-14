import "server-only";
import { createHmac } from "node:crypto";
import { SITE_URL, DESK_EMAIL } from "@/lib/site";

export const emailReady = () => !!process.env.RESEND_API_KEY;
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export const abs = (link: string) => (link.startsWith("http") ? link : SITE_URL + link);

const secret = () => process.env.SESSION_SECRET || process.env.DATABASE_URL || "pehla-round-local-dev";
export const unsubToken = (userId: number) => `${userId}.${createHmac("sha256", secret()).update("unsub|" + userId).digest("base64url").slice(0, 22)}`;
export function unsubUser(token: string) {
  const [id] = token.split(".");
  return token === unsubToken(Number(id)) ? Number(id) : null;
}

/** Building blocks for email bodies (inline styles: email clients ignore style sheets). */
export const E = {
  p: (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3b4663">${html}</p>`,
  h: (t: string) => `<h2 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#0b1730">${esc(t)}</h2>`,
  btn: (label: string, link: string) => `<p style="margin:20px 0 22px"><a href="${abs(link)}" style="display:inline-block;background:#1f4fff;color:#ffffff;padding:12px 20px;border-radius:9px;text-decoration:none;font-weight:bold;font-size:15px">${esc(label)}</a></p>`,
  a: (label: string, link: string) => `<a href="${abs(link)}" style="color:#1f4fff">${esc(label)}</a>`,
  list: (items: string[]) => `<ul style="margin:0 0 16px;padding-left:20px;color:#3b4663;font-size:15px;line-height:1.6">${items.map((i) => `<li style="margin:0 0 6px">${i}</li>`).join("")}</ul>`,
  deal: (title: string, meta: string, score: number | null, link: string) => `<a href="${abs(link)}" style="display:block;text-decoration:none;border:1px solid #e3e7ef;border-radius:12px;padding:12px 14px;margin:0 0 10px;background:#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><b style="color:#0b1730;font-size:15px">${esc(title)}</b><br><span style="color:#6b7590;font-size:13px">${esc(meta)}</span></td>
    ${score != null ? `<td style="vertical-align:middle;text-align:right;white-space:nowrap"><span style="display:inline-block;background:#e8f7f1;color:#0e9f6e;border-radius:999px;padding:6px 10px;font-weight:bold;font-size:13px">${score.toFixed(1)} / 10</span></td>` : ""}</tr></table></a>`,
};

/** The house email: header, body, signature, footer with unsubscribe for series emails. */
export function layout(body: string, opts: { preheader?: string; unsubscribeFor?: number; signature?: string } = {}) {
  const sig = opts.signature ?? `<p style="margin:18px 0 0;font-size:14px;color:#3b4663">The Before the Bell team<br><a href="mailto:${DESK_EMAIL}" style="color:#1f4fff">${DESK_EMAIL}</a> · <a href="${SITE_URL}" style="color:#1f4fff">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>`;
  const unsub = opts.unsubscribeFor ? ` · <a href="${SITE_URL}/api/unsubscribe?t=${unsubToken(opts.unsubscribeFor)}" style="color:#6b7590">Stop these emails</a>` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f9">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader || "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
<tr><td style="background:#0b1730;padding:18px 24px"><img src="${SITE_URL}/mark-email.png" width="26" height="26" alt="" style="display:inline-block;width:26px;height:26px;border:0;vertical-align:middle;border-radius:6px">
<span style="color:#ffffff;font-weight:bold;font-size:16px;margin-left:8px;vertical-align:middle">Before the Bell</span></td></tr>
<tr><td style="padding:26px 24px 22px">${body}${sig}</td></tr>
<tr><td style="padding:14px 24px 20px;border-top:1px solid #eef0f5;font-size:11.5px;line-height:1.5;color:#6b7590">You receive this because your family office is registered on Before the Bell, operated by SintraCap Advisors LLP, Lower Parel, Mumbai. Nothing in this email is an offer or advice; investments in unlisted companies can lose their entire value.${unsub}</td></tr>
</table></td></tr></table></body></html>`;
}

export type Attachment = { filename: string; content: Uint8Array | Buffer };

/** Sends one email per address through Resend. Returns how many were accepted. */
export async function sendRaw(to: string[], subject: string, html: string, attachments: Attachment[] = [], replyTo?: string) {
  if (!emailReady() || !to.length) return 0;
  const from = process.env.EMAIL_FROM || "Before the Bell <desk@offmarketdesk.in>";
  let sent = 0;
  for (const addr of to) {
    try {
      const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: addr, subject, html, reply_to: replyTo || DESK_EMAIL,
          attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }) });
      if (r.ok) sent++;
    } catch { /* best effort; the in-app record stands */ }
  }
  return sent;
}
