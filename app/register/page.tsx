import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, pendingIdentity } from "@/lib/auth";
import { providers } from "@/lib/oauth";
import { emailReady } from "@/lib/email";
import { OAuthButtons } from "@/components/OAuthButtons";
import { GRIEVANCE } from "@/lib/site";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deskInvites } from "@/db/schema";

export const metadata: Metadata = { title: "Register your family office", description: "Register your family office. Once the desk approves it, every company on the desk opens by name; each company's room opens with its own NDA." };
type P = { searchParams: Promise<{ next?: string; error?: string; invite?: string }> };

export default async function Register({ searchParams }: P) {
  const { next = "", error, invite = "" } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  const pend = await pendingIdentity(), provs = providers(), mail = emailReady();
  const inv = invite ? (await (await getDb()).select().from(deskInvites).where(and(eq(deskInvites.token, invite), isNull(deskInvites.usedAt))))[0] : undefined;
  return (
    <main><div className="wrap split" style={{ padding: "clamp(40px,6vw,72px) var(--gutter)" }}>
      <div className="rv inview">
        <ol className="stepper" aria-label="Step 1 of 3">
          <li className="now"><span className="dot">1</span><span className="t">Register the office</span><span className="s">one form</span></li>
          <li><span className="dot">2</span><span className="t">Approved by the desk</span><span className="s">usually a working day</span></li>
          <li><span className="dot">3</span><span className="t">Sign a deal&apos;s NDA</span><span className="s">name and an email code</span></li>
        </ol>
        <span className="eyebrow">Family office registration</span>
        <h1>Register the office</h1>
        <p className="lede">Step one takes a minute. Once the desk approves your office, usually within a working day, you see every company on the desk with its round and valuation. Each room opens with an NDA signed with your name and a code we email you; KYC comes only if you commit. No fee for family offices, ever.</p>
        <ol className="statusrail" aria-label="Your status"><li className="now">Registered</li><li>Approved by the desk</li><li>NDA per deal</li><li>Rooms unlocked</li></ol>
        <ul className="ticks">
          <li>A new deal reaches the desk about every fortnight; you are told the day it does.</li>
          <li>No fee for the office: not to register, not to open a room, not to commit.</li>
          <li>Each deal has its own NDA, signed directly with that company; it opens that company&apos;s room only.</li>
          <li>Add your CIO, CFO or CA as viewers; they join your office when they register with that email.</li>
          <li>No PAN or ID to look at deals or sign an NDA. KYC, bank account, demat and the authorised signatory come only at commitment.</li>
          <li>The family&apos;s money moves directly to the company or seller, never through the desk.</li>
        </ul>
      </div>
      <div className="rv inview" style={{ ["--d" as string]: ".1s" }}>
        <form className="form" method="post" action="/api/auth/register" data-api="">
          <input type="hidden" name="next" value={next} />
          {inv && <input type="hidden" name="invite" value={inv.token} />}
          {inv && <div className="ok show" role="status">You were invited by the desk. Your office is approved as soon as you register.</div>}
          {invite && !inv && <div className="ok show bad" role="alert">This invitation link was already used or is not valid. You can still register; the desk approves new offices within a working day.</div>}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
          {error && <div className="ok show bad" role="alert">{error}</div>}
          {pend ? <div className="ok show" role="status">Confirmed by {pend.provider} as <b>{pend.email}</b>. Fill in the office details below; no password needed. You sign in with {pend.provider} next time.</div>
            : <OAuthButtons list={provs} next={next} verb="Register with" />}
          <div className="row"><label>Your name<input required autoComplete="name" name="name" defaultValue={inv?.name || pend?.name || ""} /></label>
            <label>Family office or family name<input required autoComplete="organization" placeholder="e.g. Mehta Family Office" name="entity" defaultValue={inv?.officeName || ""} /></label></div>
          <div className="row"><label>Email<input type="email" required autoComplete="email" name="email" defaultValue={pend?.email || inv?.email || ""} readOnly={!!pend} /></label>
            <label>Mobile<input type="tel" required autoComplete="tel" placeholder="+91" name="phone" /></label></div>
          <div className="row">{pend ? <div className="reg-noPw"><span className="k">Password</span><p className="fine">Not needed: {pend.provider} confirmed your email.</p></div>
              : mail ? <label>Password (optional)<input type="password" minLength={8} autoComplete="new-password" name="password" /><span className="hint">Leave it empty to sign in with a code we email you.</span></label>
              : <label>Password<input type="password" required minLength={8} autoComplete="new-password" name="password" /><span className="hint">At least 8 characters.</span></label>}
            <label>Your role<select name="role" required defaultValue=""><option value="" disabled>Select</option><option>Principal / family member</option><option>CIO or investment head</option><option>CFO, CA or adviser to the family</option><option>Analyst or associate</option></select></label></div>
          <div className="row"><label>The office invests as<select name="category" required defaultValue=""><option value="" disabled>Select</option><option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>Family-office AIF</option><option>Other</option></select></label>
            <label>Residency<select name="residency" required defaultValue=""><option value="" disabled>Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label></div>
          <div className="row"><label>Typical ticket per deal<select name="ticket" required defaultValue=""><option value="" disabled>Select</option><option>₹50 lakh – 1 crore</option><option>₹1–2 crore</option><option>₹2–5 crore</option><option>₹5–25 crore</option><option>Above ₹25 crore</option></select></label>
            <label>Viewers to add (optional)<input name="viewers" placeholder="CIO, CFO or CA emails" /></label></div>
          <p className="notice"><b>Privacy notice.</b> We use these details to identify your office and to prepare documents. We keep them while the office is registered and for the period the law requires for offeree records, then delete them. You can ask for a copy, a correction or deletion at <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a>. Full notice: <a href="/legal">privacy</a>.</p>
          <label className="chk"><input type="checkbox" required name="privacy" />I have read the privacy notice and consent to this use of my details.</label>
          <label className="chk"><input type="checkbox" required name="risk" />I understand that unlisted investments are illiquid and can lose their entire value, that Off Market Desk does not advise the family, and that the office decides on the documents and its own advice.</label>
          <label className="chk"><input type="checkbox" name="contact" />Optional: Off Market Desk may call, email or WhatsApp me about deals on the desk. I can withdraw this at any time.</label>
          <div><button className="btn primary" type="submit">Register</button></div>
          <p className="fine">Already registered? <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</a>.</p>
        </form>
      </div>
    </div></main>
  );
}
