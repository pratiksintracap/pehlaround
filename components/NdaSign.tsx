import { NdaText } from "@/components/NdaText";

export type ProfileNeed = { phone?: boolean; category?: boolean; residency?: boolean; ticket?: boolean; role?: boolean };

/** Sign a company's NDA on the deal page. People who registered through the short invitation form give the
 *  rest of their profile here, once, before their first NDA (the company's NDA names the signatory and entity). */
export function NdaSign({ deal, name, office, email, mailOn, trusted, need = {} }: { deal: { slug: string; company: string; ndaVersion: string }; name: string; office: string; email: string; mailOn: boolean; trusted: boolean; need?: ProfileNeed }) {
  const anyNeed = Object.values(need).some(Boolean);
  const [nm, dom] = email.split("@");
  const masked = `${nm.slice(0, 2)}${"•".repeat(Math.min(4, Math.max(1, nm.length - 2)))}@${dom}`;
  const needCode = mailOn && !trusted;
  return (
    <form className="form nda-inline" id="sign" method="post" action="/api/nda" data-api="">
      <input type="hidden" name="slug" value={deal.slug} />
      <span className="k">Open the room: sign {deal.company}&apos;s NDA</span>
      <p className="fine">An NDA between {office} and {deal.company}. Sign it here and the room opens at once.</p>
      <details className="nda-read"><summary>Read the NDA</summary><NdaText company={deal.company} office={office} version={deal.ndaVersion} /></details>
      {anyNeed && <fieldset className="nda-prof"><legend>A few details first, asked once</legend>
        <p className="fine">The company&apos;s NDA records who signs and for which entity. You will not be asked again.</p>
        {need.phone && <label>Your mobile<input type="tel" required autoComplete="tel" placeholder="+91" name="phone" /></label>}
        {need.category && <label>Investing entity<select name="category" required defaultValue=""><option value="" disabled>Select</option><option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>AIF Category I</option><option>AIF Category II</option><option>AIF Category III</option><option>PMS</option><option>Other</option></select></label>}
        {need.role && <label>Your role<select name="role" required defaultValue=""><option value="" disabled>Select</option><option>Principal / family member</option><option>Investing in my own name</option><option>CIO, fund manager or investment head</option><option>CFO, CA or adviser</option><option>Analyst or associate</option></select></label>}
        {need.residency && <label>Residency<select name="residency" required defaultValue=""><option value="" disabled>Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label>}
        {need.ticket && <label>Typical ticket per deal<select name="ticket" required defaultValue=""><option value="" disabled>Select</option><option>₹50 lakh – 1 crore</option><option>₹1–2 crore</option><option>₹2–5 crore</option><option>₹5–25 crore</option><option>Above ₹25 crore</option></select></label>}
      </fieldset>}
      <label>Your full name, as signatory<input required autoComplete="name" name="sig" defaultValue={name} /></label>
      <label className="chk"><input type="checkbox" required name="agree" />I have read this agreement and sign it on behalf of {office}.</label>
      {needCode ? (
        <div className="codebox" data-codebox={deal.slug}>
          <div className="cb-send"><button type="button" className="btn primary" data-send-code="">Email me a signing code</button>
            <span className="fine">Six digits to <b>{masked}</b>, valid 10 minutes. Needed once on this device; for 30 days after, you just sign.</span></div>
          <label className="cb-enter" hidden>Signing code from your email<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6 digits" />
            <span className="hint"><span data-code-status /> <button type="button" className="linkbtn" data-send-code="">Send a new code</button></span></label>
          <div className="cb-sign" hidden><button className="btn primary" type="submit">Sign and open the room</button></div>
        </div>
      ) : <div><button className="btn primary" type="submit">Sign and open the room</button></div>}
      <p className="fine">Signing records your name{mailOn ? (trusted ? ", this device's earlier email confirmation" : ", the email code") : ""}, the time, your IP address and the agreement version. The signed copy is kept in your office&apos;s documents.</p>
    </form>
  );
}
