"use client";
import { useEffect, useState } from "react";

// Request access to the credit desk, as a borrowing NBFC, a lending NBFC or a company seeking a larger loan.
// Goes to the desk's own leads (kind "credit"); no financials or deal details are asked for here.
export function RequestAccess() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [side, setSide] = useState("borrower");
  useEffect(() => {
    const as = new URLSearchParams(window.location.search).get("as");
    if (as === "lender" || as === "borrower" || as === "company") setSide(as);
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
  if (state === "sent") return <div className="ok" role="status">Thanks. Your request is with the credit desk, and we&apos;ll be in touch by email.</div>;
  return (
    <form className="form cr-form" onSubmit={onSubmit}>
      <fieldset className="cr-sides"><legend>You&apos;re joining as</legend>
        {[["borrower", "A borrowing NBFC"], ["lender", "A lending NBFC or institution"], ["company", "A company seeking a larger loan"]].map(([v, l]) =>
          <label key={v} className="chk"><input type="radio" name="side" value={v} required checked={side === v} onChange={() => setSide(v)} /> {l}</label>)}
      </fieldset>
      <div className="row"><label>Your name<input name="name" required maxLength={200} autoComplete="name" /></label><label>{side === "company" ? "Company" : "NBFC or institution"}<input name="entity" required maxLength={200} autoComplete="organization" /></label></div>
      <div className="row"><label>Work email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label><label>Phone<input name="phone" type="tel" required maxLength={40} autoComplete="tel" placeholder="+91" /></label></div>
      <label>Anything we should know (optional)<textarea name="note" rows={3} maxLength={2000} /></label>
      <label className="chk"><input type="checkbox" name="consent" value="yes" required /> <span>I agree that SintraCap Advisors LLP may use these details to respond and set up access, as set out in the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.</span></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      {state === "error" && <div className="err" role="alert">{error}</div>}
      <div><button className="btn primary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Request access"}</button></div>
      <p className="fine">Please don&apos;t include financials or deal details here. The desk sets up a secure account first.</p>
    </form>
  );
}
