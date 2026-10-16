import "server-only";
import { layout, E, esc, SIGNATURE } from "@/lib/email";
import { SITE_URL, DESK_EMAIL } from "@/lib/site";

/** The personal invitation an investor gets from the desk: written as a letter from the person inviting them,
 *  not a system notice. The link registers them already approved. */
export function inviteEmail(o: { name?: string | null; officeName?: string | null; token: string; from?: { name: string; title?: string }; greeting?: string; known?: boolean }) {
  const nm = (o.name || "").trim();
  // "Mr Singhania" stays whole; "Charles / Ashish" becomes "Charles and Ashish"; otherwise the first name.
  const first = /^(mr|ms|mrs|dr)\b/i.test(nm) ? nm : nm.split("/").map((x) => x.trim().split(/\s+/)[0]).filter(Boolean).join(" and ");
  const office = (o.officeName || "").trim();
  const link = `${SITE_URL}/invite/${o.token}`;
  const subject = office ? `An invitation for ${office}: Before the Bell` : "An invitation to Before the Bell";
  const body =
    E.p(`Dear ${esc(o.greeting || first || "Investor")},`) +
    E.p(`We would like to invite ${office ? `<b>${esc(office)}</b>` : "you"} to <b>Before the Bell</b>, the desk SintraCap runs for investing in companies before they list.`) +
    (o.known ? E.p(`You have seen some of our companies over email in the last few weeks. From now on they sit in one place, with their numbers and documents, and so will every new one.`) : "") +
    E.p(`The companies we bring are profitable, sensibly priced and on their way to an IPO. They are not the names already doing the rounds; we find them, visit them and vet them before they reach the desk, and we put our own capital into every one of them. A new company comes to the desk roughly every fortnight.`) +
    E.p(`This invitation is personal. It registers ${office ? esc(office) : "you"} already approved, so you see each company by name, with its pitch deck, as soon as you sign in. When one interests you, you sign that company's NDA on the desk itself and its data bank opens; if you want an allocation, you tell us from the same page. Nothing is sent around by PDF and no one calls you unless you ask.`) +
    E.btn("Open your invitation", link) +
    E.p(`<span style="color:#6b7590;font-size:13px">The link is yours alone; please do not forward it. If a colleague should have access too, reply and we will send a separate one. Registering does not commit you to anything.</span>`) +
    E.p(`If you would rather talk first, reply to this email or write to us at <a href="mailto:${DESK_EMAIL}" style="color:#1f4fff">${DESK_EMAIL}</a>.`);
  const signature = SIGNATURE;
  const footer = `You received this one-time invitation from the Before the Bell desk. Nothing is created unless you register. Before the Bell is operated by SintraCap Advisors LLP, Lower Parel, Mumbai. Nothing in this email is an offer or advice; investments in unlisted companies can lose their entire value.`;
  const html = layout(body, { preheader: `${office || "You"} ${office ? "is" : "are"} invited to the desk. Your link registers you already approved.`, signature, footer, campaign: { medium: "invite", campaign: "desk-invite" } });
  return { subject, html };
}
