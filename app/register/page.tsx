import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { GRIEVANCE } from "@/lib/site";

export const metadata: Metadata = { title: "Register your family office", description: "Register once to see every company on the desk; each company's room opens with its own NDA." };
type P = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function Register({ searchParams }: P) {
  const { next = "", error } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  return (
    <main><div className="wrap split" style={{ padding: "clamp(40px,6vw,72px) var(--gutter)" }}>
      <div className="rv inview">
        <ol className="stepper" aria-label="Step 1 of 3">
          <li className="now"><span className="dot">1</span><span className="t">Register the office</span><span className="s">one form</span></li>
          <li><span className="dot">2</span><span className="t">PAN and deal NDA</span><span className="s">one NDA per company</span></li>
          <li><span className="dot">3</span><span className="t">Deal room open</span><span className="s">at once</span></li>
        </ol>
        <span className="eyebrow">Family office registration</span>
        <h1>Register the office</h1>
        <p className="lede">Step one takes a minute and shows you every company on the desk, with its round and valuation. PAN comes at step two, with the first NDA, and KYC only if you commit. No fee for family offices, ever.</p>
        <ol className="statusrail" aria-label="Your status"><li className="now">Registered</li><li>PAN on record</li><li>NDA per deal</li><li>Rooms unlocked</li></ol>
        <ul className="ticks">
          <li>No fee for the office: not to register, not to open a room, not to commit.</li>
          <li>Each deal has its own NDA, signed directly with that company; it opens that company&apos;s room only.</li>
          <li>Add your CIO, CFO or CA as viewers; they join your office when they register with that email.</li>
          <li>Step 2 asks for the investing entity&apos;s PAN; step 3, only at commitment, asks for KYC, bank account, demat and the authorised signatory.</li>
          <li>The family&apos;s money moves directly to the company or seller, never through the desk.</li>
        </ul>
      </div>
      <div className="rv inview" style={{ ["--d" as string]: ".1s" }}>
        <form className="form" method="post" action="/api/auth/register" data-api="">
          <input type="hidden" name="next" value={next} />
          {error && <div className="ok show bad" role="alert">{error}</div>}
          <div className="row"><label>Your name<input required autoComplete="name" name="name" /></label>
            <label>Family office or family name<input required autoComplete="organization" placeholder="e.g. Mehta Family Office" name="entity" /></label></div>
          <div className="row"><label>Email<input type="email" required autoComplete="email" name="email" /></label>
            <label>Mobile<input type="tel" required autoComplete="tel" placeholder="+91" name="phone" /></label></div>
          <div className="row"><label>Password<input type="password" required minLength={8} autoComplete="new-password" name="password" /><span className="hint">At least 8 characters.</span></label>
            <label>Your role<select name="role" required defaultValue=""><option value="" disabled>Select</option><option>Principal / family member</option><option>CIO or investment head</option><option>CFO, CA or adviser to the family</option><option>Analyst or associate</option></select></label></div>
          <div className="row"><label>The office invests as<select name="category" required defaultValue=""><option value="" disabled>Select</option><option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>Family-office AIF</option><option>Other</option></select></label>
            <label>Residency<select name="residency" required defaultValue=""><option value="" disabled>Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label></div>
          <div className="row"><label>Typical ticket per deal<select name="ticket" required defaultValue=""><option value="" disabled>Select</option><option>₹50 lakh – 1 crore</option><option>₹1–2 crore</option><option>₹2–5 crore</option><option>₹5–25 crore</option><option>Above ₹25 crore</option></select></label>
            <label>Viewers to add (optional)<input name="viewers" placeholder="CIO, CFO or CA emails" /></label></div>
          <p className="notice"><b>Privacy notice.</b> We use these details to identify your office and, at step two, to verify PAN and prepare documents. We keep them while the office is registered and for the period the law requires for offeree records, then delete them. You can ask for a copy, a correction or deletion at <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a>. Full notice: <a href="/legal">privacy</a>.</p>
          <label className="chk"><input type="checkbox" required name="privacy" />I have read the privacy notice and consent to this use of my details.</label>
          <label className="chk"><input type="checkbox" required name="risk" />I understand that unlisted investments are illiquid and can lose their entire value, that Pehla Round does not advise the family, and that the office decides on the documents and its own advice.</label>
          <label className="chk"><input type="checkbox" name="contact" />Optional: Pehla Round may call, email or WhatsApp me about deals on the desk. I can withdraw this at any time.</label>
          <div><button className="btn primary" type="submit">Register</button></div>
          <p className="fine">Already registered? <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</a>.</p>
        </form>
      </div>
    </div></main>
  );
}
