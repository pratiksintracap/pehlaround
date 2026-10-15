import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, pendingIdentity } from "@/lib/auth";
import { providers } from "@/lib/oauth";
import { emailReady } from "@/lib/email";
import { OAuthButtons } from "@/components/OAuthButtons";
import { GRIEVANCE } from "@/lib/site";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealLinks, deals, deskInvites, offices } from "@/db/schema";
import { readRefCode, referrerByCode } from "@/lib/track";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Register your family office", description: "Register your family office. Once the desk approves it, every company on the desk opens by name; each company's room opens as soon as you sign its NDA." };
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
  return (
    <main><div className="wrap split reg" style={{ padding: "clamp(36px,5vw,64px) var(--gutter)" }}>
      <div className="rv inview">
        <ol className="stepper" aria-label="How it works">
          <li className="now"><span className="dot">1</span><span className="t">Register</span><span className="s">about a minute</span></li>
          <li><span className="dot">2</span><span className="t">{approvedOnSignUp ? "Approved" : "Approved by the desk"}</span><span className="s">{approvedOnSignUp ? "at once" : st.approvalTime}</span></li>
          <li><span className="dot">3</span><span className="t">Sign the NDA</span><span className="s">on the deal&apos;s page</span></li>
        </ol>
        <span className="eyebrow">Family office registration</span>
        <h1>{lkDeal ? <>The desk sent you<br />{lkDeal.title}</> : "Register the office"}</h1>
        <p className="lede">{lkDeal
          ? `Register in a minute and your office is approved straight away; ${lkDeal.title} (${lkDeal.category}) opens next, with its NDA signed on screen.`
          : approvedOnSignUp ? "Your office is approved as soon as you register, and every company on the desk opens by name."
          : `The desk approves new offices ${st.approvalTime}. Then every company on the desk opens by name, with its round and valuation.${forDeal ? " We take you straight back to the deal you were looking at." : ""}`}</p>
        <ul className="ticks">
          <li>No PAN or ID to look at deals or sign an NDA. KYC comes only if your office invests.</li>
          <li>Add your CIO, CFO or CA from your dashboard; they join your office.</li>
          <li>The family&apos;s money moves directly to the company or seller, never through the desk.</li>
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
          {lk && <div className="ok show" role="status">Sent by the desk. Your office is approved as soon as you register.</div>}
          {byCode && !inv && !lk && <div className="ok show" role="status">Referred by {byCode.name}. {approvedOnSignUp ? "Your office is approved as soon as you register." : `The desk approves new offices ${st.approvalTime}.`}</div>}
          {inv && !lk && <div className="ok show" role="status">{referrer ? `Referred by ${referrer}. ` : "Invited by the desk. "}{approvedOnSignUp ? "Your office is approved as soon as you register." : `The desk approves new offices ${st.approvalTime}.`}</div>}
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
            <span className="rs-h">Step 2 of 2 · The office <button type="button" className="linkbtn" data-step-back="">Back</button></span>
            <label>Family office or family name<input required autoComplete="organization" placeholder="e.g. Mehta Family Office" name="entity" defaultValue={pre.office} /></label>
            <div className="row"><label>Your role<select name="role" required defaultValue=""><option value="" disabled>Select</option><option>Principal / family member</option><option>CIO or investment head</option><option>CFO, CA or adviser to the family</option><option>Analyst or associate</option></select></label>
              <label>The office invests as<select name="category" required defaultValue=""><option value="" disabled>Select</option><option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>Family-office AIF</option><option>Other</option></select></label></div>
            <div className="row"><label>Residency<select name="residency" required defaultValue=""><option value="" disabled>Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label>
              <label>Typical ticket per deal<select name="ticket" required defaultValue=""><option value="" disabled>Select</option><option>₹50 lakh – 1 crore</option><option>₹1–2 crore</option><option>₹2–5 crore</option><option>₹5–25 crore</option><option>Above ₹25 crore</option></select></label></div>
            <label className="chk"><input type="checkbox" required name="privacy" />I consent to the use of my details as set out in the <a href="/legal" target="_blank">privacy notice</a>: to identify the office and prepare documents, kept while the office is registered and as the law requires. Questions or deletion: <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a>.</label>
            <label className="chk"><input type="checkbox" required name="risk" />I have read the <a href="#" data-show-disclaimer="">site disclaimer</a> and understand that unlisted investments are illiquid and can lose their entire value, that Before the Bell does not advise the family, and that the office decides on the documents and its own advice.</label>
            <label className="chk"><input type="checkbox" name="contact" />Optional: Before the Bell may call, email or WhatsApp me about deals on the desk. I can withdraw this at any time.</label>
            <div><button className="btn primary" type="submit">{approvedOnSignUp ? "Register and continue" : "Register"}</button></div>
          </div>
          <p className="fine">Already registered? <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</a>.</p>
        </form>
      </div>
    </div></main>
  );
}
