import "server-only";
import { createHmac } from "node:crypto";
import { SITE_URL, DESK_EMAIL } from "@/lib/site";
import { getDb } from "@/lib/db";
import { emailLog } from "@/db/schema";

export const emailReady = () => !!process.env.RESEND_API_KEY;
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export const abs = (link: string) => (link.startsWith("http") ? link : SITE_URL + link);

/** Turns URLs, bare domains and email addresses in already-escaped text into proper links, so mail clients
 *  show the readable text instead of rewriting it into a tracking URL. */
export function linkify(escapedText: string) {
  const RE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)])|(\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b)|(\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:in|com|io|co|net|org|club)(?:\/[^\s<>"]*[^\s<>".,;:!?)])?\b)/gi;
  const A = 'style="color:#1f4fff"';
  return escapedText.replace(RE, (m, url, mail, dom) => {
    if (url) return `<a href="${url}" ${A}>${url.replace(/^https?:\/\//, "")}</a>`;
    if (mail) return `<a href="mailto:${mail}" ${A}>${mail}</a>`;
    if (dom) return `<a href="https://${dom}" ${A}>${dom}</a>`;
    return m;
  });
}

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
  /** A row of buttons; the first is solid, the rest outlined. */
  btns: (bs: { label: string; link: string }[]) => `<p style="margin:20px 0 14px">${bs.map((b, i) => `<a href="${abs(b.link)}" style="display:inline-block;margin:0 8px 8px 0;${i ? "background:#ffffff;color:#1f4fff;border:1px solid #1f4fff;padding:11px 19px" : "background:#1f4fff;color:#ffffff;padding:12px 20px"};border-radius:9px;text-decoration:none;font-weight:bold;font-size:15px">${esc(b.label)}</a>`).join("")}</p>`,
  a: (label: string, link: string) => `<a href="${abs(link)}" style="color:#1f4fff">${esc(label)}</a>`,
  list: (items: string[]) => `<ul style="margin:0 0 16px;padding-left:20px;color:#3b4663;font-size:15px;line-height:1.6">${items.map((i) => `<li style="margin:0 0 6px">${i}</li>`).join("")}</ul>`,
  deal: (title: string, meta: string, score: number | null, link: string) => `<a href="${abs(link)}" style="display:block;text-decoration:none;border:1px solid #e3e7ef;border-radius:12px;padding:12px 14px;margin:0 0 10px;background:#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><b style="color:#0b1730;font-size:15px">${esc(title)}</b><br><span style="color:#6b7590;font-size:13px">${esc(meta)}</span></td>
    ${score != null ? `<td style="vertical-align:middle;text-align:right;white-space:nowrap"><span style="display:inline-block;background:#e8f7f1;color:#0e9f6e;border-radius:999px;padding:6px 10px;font-weight:bold;font-size:13px">${score.toFixed(1)} / 10</span></td>` : ""}</tr></table></a>`,
};

/** Adds utm tags to every link into the site, so visits and registrations from an email show their campaign.
 *  API links (unsubscribe, sign-in) and links that already carry tags are left alone. */
export function tagLinks(html: string, utm: { source: string; medium: string; campaign: string }) {
  const base = SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`href="(${base}(?:/[^"#?]*)?)(\\?[^"#]*)?(#[^"]*)?"`, "g");
  const tags = `utm_source=${encodeURIComponent(utm.source)}&utm_medium=${encodeURIComponent(utm.medium)}&utm_campaign=${encodeURIComponent(utm.campaign)}`;
  return html.replace(re, (m, path: string, query = "", hash = "") => {
    if (/\/api\//.test(path) || /utm_/.test(query)) return m;
    return `href="${path}${query ? query + "&" : "?"}${tags}${hash}"`;
  });
}

/** The desk's signature on every email: the Investment Team, never a person's name. */
export const SIGNATURE = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0;border-top:1px solid #eef0f5;padding-top:16px"><tr>
<td style="vertical-align:top;padding:16px 12px 0 0"><img src="${SITE_URL}/icon-512.png" width="40" height="40" alt="Before the Bell" style="display:block;width:40px;height:40px;border-radius:9px;border:0"></td>
<td style="vertical-align:top;padding-top:16px;font-size:14px;line-height:1.5;color:#3b4663"><b style="color:#0b1730">Investment Team</b><br>Before the Bell<br>
<a href="mailto:${DESK_EMAIL}" style="color:#1f4fff;text-decoration:none">${DESK_EMAIL}</a> · <a href="${SITE_URL}" style="color:#1f4fff;text-decoration:none">${SITE_URL.replace(/^https?:\/\//, "")}</a></td></tr></table>`;

/** The house email: header, body, signature, footer with unsubscribe for series emails. */
export function layout(body: string, opts: { preheader?: string; unsubscribeFor?: number; signature?: string; footer?: string; unsubscribeLink?: string; campaign?: { medium: string; campaign: string } } = {}) {
  const sig = opts.signature ?? SIGNATURE;
  const unsubHref = opts.unsubscribeLink || (opts.unsubscribeFor ? `${SITE_URL}/api/unsubscribe?t=${unsubToken(opts.unsubscribeFor)}` : "");
  const unsub = unsubHref ? ` · <a href="${unsubHref}" style="color:#6b7590">Stop these emails</a>` : "";
  const footer = opts.footer || "You receive this because you are registered on Before the Bell, operated by SintraCap Advisors LLP, Lower Parel, Mumbai. Nothing in this email is an offer or advice; investments in unlisted companies can lose their entire value.";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f9">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader || "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
<tr><td style="background:#0b1730;padding:18px 24px"><img src="${SITE_URL}/mark-email.png" width="26" height="26" alt="" style="display:inline-block;width:26px;height:26px;border:0;vertical-align:middle;border-radius:6px">
<span style="color:#ffffff;font-weight:bold;font-size:16px;margin-left:8px;vertical-align:middle">Before the Bell</span></td></tr>
<tr><td style="padding:26px 24px 22px">${body}${sig}</td></tr>
<tr><td style="padding:14px 24px 20px;border-top:1px solid #eef0f5;font-size:11.5px;line-height:1.5;color:#6b7590">${footer}${unsub}</td></tr>
</table></td></tr></table></body></html>`;
  return opts.campaign ? tagLinks(html, { source: "email", ...opts.campaign }) : html;
}

export type Attachment = { filename: string; content: Uint8Array | Buffer };
/** What an email is for, kept with its delivery record (see /admin/emails). */
export type MailMeta = { kind?: string; step?: string; userId?: number | null; officeId?: number | null };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const RESEND_API = () => process.env.RESEND_API_URL || "https://api.resend.com/emails";

/** Sends one email per address through Resend and records each one. Returns how many were accepted. */
export async function sendRaw(to: string[], subject: string, html: string, attachments: Attachment[] = [], replyTo?: string, meta: MailMeta = {}) {
  if (!emailReady() || !to.length) return 0;
  const from = process.env.EMAIL_FROM || "Before the Bell <desk@beforethebell.in>";
  const post = (addr: string) => fetch(RESEND_API(), { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: addr, subject, html, reply_to: replyTo || DESK_EMAIL,
      attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }) });
  let sent = 0;
  for (const [i, addr] of to.entries()) {
    if (i > 0) await pause(600); // Resend accepts about two requests a second; stay under it
    try {
      let r = await post(addr);
      // Rate-limited: wait as long as Resend asks (or a second) and try twice more.
      for (let k = 0; r.status === 429 && k < 2; k++) { await pause(Math.min(5000, 1000 * (Number(r.headers.get("retry-after")) || 1))); r = await post(addr); }
      if (r.ok) {
        sent++;
        const id = await r.json().then((j: { id?: string }) => (typeof j?.id === "string" ? j.id : null)).catch(() => null);
        try {
          const db = await getDb();
          await db.insert(emailLog).values({ resendId: id, kind: meta.kind || "transactional", step: meta.step ?? null, userId: meta.userId ?? null, officeId: meta.officeId ?? null, to: addr, subject });
        } catch (e) { console.error("email_log", e); }
      } else console.error("resend", r.status, addr);
    } catch (e) { console.error("resend", e); }
  }
  return sent;
}
