import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getUser, pendingIdentity } from "@/lib/auth";
import { providers } from "@/lib/oauth";
import { emailReady } from "@/lib/email";
import { OAuthButtons } from "@/components/OAuthButtons";
import { GRIEVANCE, DESK_EMAIL } from "@/lib/site";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealLinks, deals, deskInvites, offices } from "@/db/schema";
import { readRefCode, referrerByCode } from "@/lib/track";
import { getSettings } from "@/lib/settings";
import { listDeals, listUpcoming } from "@/lib/deals";
import { teaserHtml } from "@/lib/render";

export const metadata: Metadata = pageMeta({ path: "/register", title: "Register as an investor", description: "Register your family office, fund or yourself as an investor. Once the desk approves it, every company on the desk opens by name; each company's room opens as soon as you sign its NDA." });
type P = { searchParams: Promise<{ next?: string; error?: string; invite?: string; link?: string; ref?: string }> };

export default async function Register({ searchParams }: P) {
  const { next: rawNext = "", error, invite = "", link = "", ref = "" } = await searchParams;
  if (await getUser()) redirect(rawNext.startsWith("/") ? rawNext : "/dashboard");
  const db = await getDb();
  const [pend, provs, mail, st] = [await pendingIdentity(), providers(), emailReady(), await getSettings()];
  const inv = invite ? (await db.select().from(deskInvites).where(and(eq(deskInvites.token, invite), isNull(deskInvites.usedAt))))[0] : undefined;
  // An office's shareable link (/register?ref=code), remembered by the middleware for 90 days.
  const byCode = !inv ? await referrerByCode(await readRefCode(ref)) : null;
  const referrer = inv?.referrerOfficeId ? (await db.select({ name: offices.name }).from(offices).where(eq(offices.id, inv.referrerOfficeId)))[0]?.name : byCode?.name;
  const lk = link ? (await db.select().from(dealLinks).where(and(eq(dealLinks.token, link), isNull(dealLinks.officeId), isNull(dealLinks.registeredAt))))[0] : undefined;
  const lkDeal = lk ? (await db.select({ slug: deals.slug, title: deals.title, category: deals.category }).from(deals).where(eq(deals.id, lk.dealId)))[0] : undefined;
  const next = lkDeal ? `/deals/${lkDeal.slug}#sign` : rawNext;
  const forDeal = /^\/deals\/[a-z0-9-]+/.test(next);
  const approvedOnSignUp = !!lk || (!!inv && (!inv.referrerOfficeId || st.referrals)) || (!!byCode && st.referrals && byCode.approval === "approved");
  const pre = { name: lk?.name || inv?.name || pend?.name || "", email: pend?.email || lk?.email || inv?.email || "", office: lk?.officeName || inv?.officeName || "" };
  // Someone the desk invited by name: a personal page and a one-step form. The rest of the profile
  // (mobile, residency, ticket, entity, role) is asked just before their first NDA.
  if (approvedOnSignUp && (inv || lk) && !inv?.referrerOfficeId) {
    const [open, coming] = await Promise.all([listDeals(), listUpcoming()]);
    const live = open.filter((d) => d.open);
    const nm = pre.name.trim();
    const first = /^(mr|ms|mrs|dr)\b/i.test(nm) ? nm : nm.split(/\s+/)[0] || "";
    const office = /\.[a-z]{2,}$/i.test(pre.office) ? "" : pre.office;
    return (
      <main><div className="wrap split reg invited" style={{ padding: "clamp(36px,5vw,64px) var(--gutter)" }}>
        <div className="rv inview">
          <span className="eyebrow">{lkDeal ? "Sent to you by the desk" : "Your invitation"}</span>
          <h1>{first ? <>Welcome, {first}.</> : "Your invitation to Before the Bell"}</h1>
          <p className="lede">{lkDeal
            ? <>Register in under a minute and {lkDeal.title} opens by name, with its pitch deck. {office || "Your office"} is approved as soon as you register.</>
            : <>{office ? <b>{office}</b> : "Your office"} is approved as soon as you register. Every company on the desk then opens by name, with its round, valuation and pitch deck.</>}</p>
          <div dangerouslySetInnerHTML={{ __html: teaserHtml(live.length ? live : open, coming.length) }} />
          <ul className="ticks">
            <li>Registering commits you to nothing. No PAN or ID until you choose to invest.</li>
            <li>When a company interests you, you sign its NDA on screen and its data room opens.</li>
            <li>No one calls you unless you ask.</li>
          </ul>
        </div>
        <div className="rv inview" style={{ ["--d" as string]: ".1s" }}>
          <form className="form reg-form quick" method="post" action="/api/auth/register" data-api="">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="quick" value="1" />
            {inv && <input type="hidden" name="invite" value={inv.token} />}
            {lk && <input type="hidden" name="link" value={lk.token} />}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
            {error && <div className="ok show bad" role="alert">{error}</div>}
            <div className="ok show" role="status">Invited by the desk{office ? ` for ${office}` : ""}. You are approved as soon as you register.</div>
            {pend ? <div className="ok show" role="status">Confirmed by {pend.provider} as <b>{pend.email}</b>. No password needed.</div>
              : <OAuthButtons list={provs} next={next} verb="Continue with" />}
            <label>Your name<input required autoComplete="name" name="name" defaultValue={pre.name} /></label>
            <label>Email<input type="email" required autoComplete="email" name="email" defaultValue={pre.email} readOnly={!!pend} /></label>
            <label>Family office, fund or investor<input required autoComplete="organization" name="entity" defaultValue={office} placeholder="e.g. Mehta Family Office" /></label>
            <label>You are investing as<select name="itype" required defaultValue=""><option value="" disabled>Select</option><option value="family_office">A family office</option><option value="fund">A fund (AIF, PMS or other)</option><option value="individual">An individual investor</option></select></label>
            <fieldset className="only-ind"><legend>Individual investors</legend>
              <p className="fine">The desk shows companies to individuals who are accredited investors or who invest at least ₹25 lakh per company.</p>
              <label className="chk"><input type="radio" name="decl" value="accredited" />I am an accredited investor under SEBI&apos;s framework, or will be by the time I invest.</label>
              <label className="chk"><input type="radio" name="decl" value="min_ticket_25l" />I will invest at least ₹25 lakh in any company I request an allocation in.</label>
            </fieldset>
            {pend ? null : mail
              ? <label>Password (optional)<input type="password" minLength={8} autoComplete="new-password" name="password" /><span className="hint">Leave it empty to sign in with a code we email you.</span></label>
              : <label>Password<input type="password" required minLength={8} autoComplete="new-password" name="password" /><span className="hint">At least 8 characters.</span></label>}
            <label className="chk"><input type="checkbox" required name="consent" /><span>I accept the <a href="/legal" target="_blank">privacy notice</a> and the <a href="#" data-show-disclaimer="">site disclaimer</a>, and understand that unlisted investments are illiquid and can lose their entire value.</span></label>
            <div><button className="btn primary" type="submit">Register and see the companies</button></div>
            <p className="fine">Already registered? <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</a>. Questions: <a href={`mailto:${DESK_EMAIL}`}>{DESK_EMAIL}</a>.</p>
          </form>
        </div>
      </div></main>
    );
  }
  return (
    <main><div className="wrap split reg" style={{ padding: "clamp(36px,5vw,64px) var(--gutter)" }}>
      <div className="rv inview">
        <ol className="stepper" aria-label="How it works">
          <li className="now"><span className="dot">1</span><span className="t">Register</span><span className="s">about a minute</span></li>
          <li><span className="dot">2</span><span className="t">{approvedOnSignUp ? "Approved" : "Approved by the desk"}</span><span className="s">{approvedOnSignUp ? "at once" : st.approvalTime}</span></li>
          <li><span className="dot">3</span><span className="t">Sign the NDA</span><span className="s">on the deal&apos;s page</span></li>
        </ol>
        <span className="eyebrow">Investor registration</span>
        <h1>{lkDeal ? <>The desk sent you<br />{lkDeal.title}</> : "Register to see the desk"}</h1>
        <p className="lede">{lkDeal
          ? `Register in a minute and your office is approved straight away; ${lkDeal.title} (${lkDeal.category}) opens next, with its NDA signed on screen.`
          : approvedOnSignUp ? "Your office is approved as soon as you register, and every company on the desk opens by name."
          : `The desk approves new investors ${st.approvalTime}. Then every company on the desk opens by name, with its round and valuation.${forDeal ? " We take you straight back to the deal you were looking at." : ""}`}</p>
        <ul className="ticks">
          <li>No PAN or ID to look at deals or sign an NDA. KYC comes only when you invest.</li>
          <li>Add your CIO, CFO or CA from your dashboard; they join your account.</li>
          <li>Your money moves directly to the company or seller, never through the desk.</li>
        </ul>
      </div>
      <div className="rv inview" style={{ ["--d" as string]: ".1s" }}>
        <form className="form reg-form" method="post" action="/api/auth/register" data-api="" data-steps="">
          <input type="hidden" name="next" value={next} />
          {inv && <input type="hidden" name="invite" value={inv.token} />}
          {lk && <input type="hidden" name="link" value={lk.token} />}
          {byCode?.refCode && <input type="hidden" name="ref" value={byCode.refCode} />}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
          {error && <div className="ok show bad" role="alert">{error}</div>}
          {lk && <div className="ok show" role="status">Sent by the desk. You are approved as soon as you register.</div>}
          {byCode && !inv && !lk && <div className="ok show" role="status">Referred by {byCode.name}. {approvedOnSignUp ? "You are approved as soon as you register." : `The desk approves new investors ${st.approvalTime}.`}</div>}
          {inv && !lk && <div className="ok show" role="status">{referrer ? `Referred by ${referrer}. ` : "Invited by the desk. "}{approvedOnSignUp ? "You are approved as soon as you register." : `The desk approves new investors ${st.approvalTime}.`}</div>}
          {invite && !inv && <div className="ok show bad" role="alert">This invitation link was already used or is not valid. You can still register; the desk approves new offices {st.approvalTime}.</div>}
          {link && !lk && <div className="ok show bad" role="alert">This link was already used. If you registered with it, sign in instead.</div>}

          <div className="rs rs-1">
            <span className="rs-h">Step 1 of 2 · You</span>
            {pend ? <div className="ok show" role="status">Confirmed by {pend.provider} as <b>{pend.email}</b>. No password needed.</div>
              : <OAuthButtons list={provs} next={next} verb="Continue with" />}
            <label>Your name<input required autoComplete="name" name="name" defaultValue={pre.name} /></label>
            <div className="row"><label>Email<input type="email" required autoComplete="email" name="email" defaultValue={pre.email} readOnly={!!pend} /></label>
              <label>Mobile<input type="tel" required autoComplete="tel" placeholder="+91" name="phone" /></label></div>
            {pend ? null : mail
              ? <label>Password (optional)<input type="password" minLength={8} autoComplete="new-password" name="password" /><span className="hint">Leave it empty to sign in with a code we email you.</span></label>
              : <label>Password<input type="password" required minLength={8} autoComplete="new-password" name="password" /><span className="hint">At least 8 characters.</span></label>}
            <div className="rs-next"><button type="button" className="btn primary" data-step-next="">Continue</button></div>
          </div>

          <div className="rs rs-2">
            <span className="rs-h">Step 2 of 2 · How you invest <button type="button" className="linkbtn" data-step-back="">Back</button></span>
            <label>You are investing as<select name="itype" required defaultValue=""><option value="" disabled>Select</option><option value="family_office">A family office</option><option value="fund">A fund (AIF, PMS or other)</option><option value="individual">An individual investor</option></select></label>
            <label>Name of the family office, fund or investor<input required autoComplete="organization" placeholder="e.g. Mehta Family Office, Alpha Growth Fund, or your own name" name="entity" defaultValue={pre.office} /></label>
            <div className="row"><label>Your role<select name="role" required defaultValue=""><option value="" disabled>Select</option><option>Principal / family member</option><option>Investing in my own name</option><option>CIO, fund manager or investment head</option><option>CFO, CA or adviser</option><option>Analyst or associate</option></select></label>
              <label>Investing entity<select name="category" required defaultValue=""><option value="" disabled>Select</option><option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>AIF Category I</option><option>AIF Category II</option><option>AIF Category III</option><option>PMS</option><option>Other</option></select></label></div>
            <fieldset className="only-ind"><legend>Individual investors</legend>
              <p className="fine">The desk shows companies to individuals who are accredited investors or who invest at least ₹25 lakh per company.</p>
              <label className="chk"><input type="radio" name="decl" value="accredited" />I am an accredited investor under SEBI&apos;s framework, or will be by the time I invest.</label>
              <label className="chk"><input type="radio" name="decl" value="min_ticket_25l" />I will invest at least ₹25 lakh in any company I request an allocation in.</label>
            </fieldset>
            <div className="row"><label>Residency<select name="residency" required defaultValue=""><option value="" disabled>Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label>
              <label>Typical ticket per deal<select name="ticket" required defaultValue=""><option value="" disabled>Select</option><option>₹50 lakh – 1 crore</option><option>₹1–2 crore</option><option>₹2–5 crore</option><option>₹5–25 crore</option><option>Above ₹25 crore</option></select></label></div>
            <label className="chk"><input type="checkbox" required name="privacy" /><span>I consent to the use of my details as set out in the <a href="/legal" target="_blank">privacy notice</a>, to identify me and prepare documents, kept while I am registered and as the law requires. Questions or deletion: <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a>.</span></label>
            <label className="chk"><input type="checkbox" required name="risk" /><span>I have read the <a href="#" data-show-disclaimer="">site disclaimer</a> and understand that unlisted investments are illiquid and can lose their entire value, that Before the Bell does not give investment advice, and that I decide on the documents and my own advice.</span></label>
            <label className="chk"><input type="checkbox" name="contact" /><span>Optional: Before the Bell may call, email or WhatsApp me about deals on the desk. I can withdraw this at any time.</span></label>
            <div><button className="btn primary" type="submit">{approvedOnSignUp ? "Register and continue" : "Register"}</button></div>
          </div>
          <p className="fine">Already registered? <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</a>.</p>
        </form>
      </div>
    </div></main>
  );
}
