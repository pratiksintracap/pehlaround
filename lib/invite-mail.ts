import "server-only";
import { layout, E, esc } from "@/lib/email";
import { SITE_URL, DESK_EMAIL } from "@/lib/site";

/** The personal invitation an investor gets from the desk: written as a letter from the person inviting them,
 *  not a system notice. The link registers them already approved. */
export function inviteEmail(o: { name?: string | null; officeName?: string | null; token: string; from: { name: string; title?: string } }) {
  const first = (o.name || "").trim().split(/\s+/)[0];
  const office = (o.officeName || "").trim();
  const link = `${SITE_URL}/invite/${o.token}`;
  const subject = office ? `An invitation for ${office}: Before the Bell` : "An invitation to Before the Bell";
  const body =
    E.p(`${first ? `Dear ${esc(first)},` : "Dear Investor,"}`) +
    E.p(`I would like to invite ${office ? `<b>${esc(office)}</b>` : "you"} to <b>Before the Bell</b>, the desk SintraCap runs for investing in companies before they list.`) +
    E.p(`The companies we bring are profitable, sensibly priced and on their way to an IPO. They are not the names already doing the rounds; we find them, visit them and vet them before they reach the desk, and we put our own capital into every one of them. A new company comes to the desk roughly every fortnight.`) +
    E.p(`This invitation is personal. It registers ${office ? esc(office) : "you"} already approved, so you see each company by name, with its pitch deck, as soon as you sign in. When one interests you, you sign that company's NDA on the desk itself and its data bank opens; if you want an allocation, you tell us from the same page. Nothing is sent around by PDF and no one calls you unless you ask.`) +
    E.btn("Open your invitation", link) +
    E.p(`<span style="color:#6b7590;font-size:13px">The link is yours alone; please do not forward it. If a colleague should have access too, reply and I will send a separate one. Registering does not commit you to anything.</span>`) +
    E.p(`If you would rather talk first, reply to this email or write to me at <a href="mailto:${DESK_EMAIL}" style="color:#1f4fff">${DESK_EMAIL}</a>.`);
  const signature = `<p style="margin:18px 0 0;font-size:15px;line-height:1.5;color:#0b1730"><b>${esc(o.from.name)}</b><br><span style="color:#3b4663">${esc(o.from.title || "SintraCap Advisors LLP")}<br>Before the Bell · <a href="${SITE_URL}" style="color:#1f4fff">${SITE_URL.replace(/^https?:\/\//, "")}</a></span></p>`;
  const footer = `You received this one-time invitation because ${esc(o.from.name)} asked the desk to send it to you. Nothing is created unless you register. Before the Bell is operated by SintraCap Advisors LLP, Lower Parel, Mumbai. Nothing in this email is an offer or advice; investments in unlisted companies can lose their entire value.`;
  const html = layout(body, { preheader: `${office || "You"} ${office ? "is" : "are"} invited to the desk. Your link registers you already approved.`, signature, footer, campaign: { medium: "invite", campaign: "desk-invite" } });
  return { subject, html };
}
