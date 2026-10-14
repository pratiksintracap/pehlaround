import { NdaText } from "@/components/NdaText";

/** Sign a company's NDA on the deal page: name filled in, read the text if you like, tick and sign. */
export function NdaSign({ deal, name, office, email, mailOn, trusted }: { deal: { slug: string; company: string; ndaVersion: string }; name: string; office: string; email: string; mailOn: boolean; trusted: boolean }) {
  const [nm, dom] = email.split("@");
  const masked = `${nm.slice(0, 2)}${"•".repeat(Math.min(4, Math.max(1, nm.length - 2)))}@${dom}`;
  const needCode = mailOn && !trusted;
  return (
    <form className="form nda-inline" id="sign" method="post" action="/api/nda" data-api="">
      <input type="hidden" name="slug" value={deal.slug} />
      <span className="k">Open the room: sign {deal.company}&apos;s NDA</span>
      <p className="fine">An NDA between {office} and {deal.company}. Sign it here and the room opens at once.</p>
      <details className="nda-read"><summary>Read the NDA</summary><NdaText company={deal.company} office={office} version={deal.ndaVersion} /></details>
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
