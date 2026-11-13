"use client";
import { useEffect, useState } from "react";

// Tell the debt desk what you need to borrow: a company or an NBFC. Goes to the desk's own leads (kind "credit").
// Only the requirement is asked for here; no financials or documents.
export function RequestAccess() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [side, setSide] = useState("company");
  useEffect(() => {
    const as = new URLSearchParams(window.location.search).get("as");
    if (as === "company" || as === "nbfc") setSide(as);
  }, []);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setState("sending");
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, kind: "credit" }) });
      if (res.ok) { setState("sent"); form.reset(); } else { setError((await res.json().catch(() => ({})))?.error ?? "We couldn't send your request. Check the form and try again."); setState("error"); }
    } catch { setError("We couldn't reach the server. Check your connection and try again."); setState("error"); }
  }
  if (state === "sent") return <div className="ok" role="status">Thanks. Your requirement is with the debt desk, and it will call you back.</div>;
  return (
    <form className="form cr-form" onSubmit={onSubmit}>
      <fieldset className="cr-sides"><legend>You are</legend>
        {[["company", "A company or promoter"], ["nbfc", "An NBFC"]].map(([v, l]) =>
          <label key={v} className="chk"><input type="radio" name="side" value={v} required checked={side === v} onChange={() => setSide(v)} /> {l}</label>)}
      </fieldset>
      <div className="row"><label>Your name<input name="name" required maxLength={200} autoComplete="name" /></label><label>{side === "nbfc" ? "NBFC" : "Company"}<input name="entity" required maxLength={200} autoComplete="organization" /></label></div>
      <div className="row"><label>Work email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label><label>Phone<input name="phone" type="tel" required maxLength={40} autoComplete="tel" placeholder="+91" /></label></div>
      <div className="row"><label>Amount you need (₹ crore)<input name="amountCr" inputMode="decimal" maxLength={20} /></label>
        <label>Type of facility<select name="facility" defaultValue=""><option value="">Not sure yet</option><option>Term loan or capex</option><option>Working capital</option><option>NCD or commercial paper</option><option>Acquisition finance</option><option>Refinancing</option><option>Loan against shares or property</option><option>Structured or mezzanine</option><option>Funding line for an NBFC</option></select></label></div>
      <label>What it is for, and the security you can offer (optional)<textarea name="note" rows={3} maxLength={2000} /></label>
      <label className="chk"><input type="checkbox" name="consent" value="yes" required /> <span>I agree that SintraCap Advisors LLP may use these details to respond to this request, as set out in the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.</span></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      {state === "error" && <div className="err" role="alert">{error}</div>}
      <div><button className="btn primary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send to the desk"}</button></div>
      <p className="fine">No documents at this stage. The desk calls you back and asks for what lenders will need.</p>
    </form>
  );
}
