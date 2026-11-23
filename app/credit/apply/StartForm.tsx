"use client";

import { useActionState, useState } from "react";
import { RegistrySuggest } from "@/components/credit/app/RegistryLookup";
import { PendingButton } from "@/components/credit/app/PendingButton";
import { PRIVACY_NOTICE_VERSION } from "@/lib/credit/brand";
import { startApplicationAction, type StartState } from "./actions";

export function StartForm() {
  const [state, action] = useActionState<StartState, FormData>(startApplicationAction, null);
  const [role, setRole] = useState<"company" | "agent">("company");
  const [company, setCompany] = useState("");
  const [cin, setCin] = useState("");
  return (
    <form action={action} className="stack">
      <fieldset className="role-pick">
        <legend className="qlabel">Who&apos;s filling this in?</legend>
        <label className={role === "company" ? "on" : ""}>
          <input type="radio" name="role" value="company" checked={role === "company"} onChange={() => setRole("company")} />
          <span><strong>Someone at the NBFC</strong><span className="muted small">Promoter, director or finance team</span></span>
        </label>
        <label className={role === "agent" ? "on" : ""}>
          <input type="radio" name="role" value="agent" checked={role === "agent"} onChange={() => setRole("agent")} />
          <span><strong>An agent or adviser</strong><span className="muted small">Acting for the NBFC</span></span>
        </label>
      </fieldset>
      <div className="row">
        <label>NBFC&apos;s name
          <input name="companyName" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
          <RegistrySuggest query={company} onPick={(r) => { setCompany(r.name); if (r.cin) setCin(r.cin); }} />
        </label>
        <label>CIN (optional)
          <input name="cin" maxLength={21} value={cin} onChange={(e) => setCin(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="U65999MH2010PTC000000" autoComplete="off" />
          <RegistrySuggest query={cin} onPick={(r) => { setCompany(r.name); if (r.cin) setCin(r.cin); }} autoPickCin />
        </label>
      </div>
      <div className="row">
        <label>Your name<input name="name" required maxLength={200} autoComplete="name" /></label>
        {role === "agent" && <label>Your firm<input name="agentFirm" required maxLength={200} autoComplete="organization" /></label>}
      </div>
      <div className="row">
        <label>Your email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
        <label>Your phone<input name="phone" type="tel" required maxLength={40} autoComplete="tel" /></label>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      <input type="hidden" name="noticeVersion" value={PRIVACY_NOTICE_VERSION} />
      <label className="check decl">
        <input type="checkbox" name="consent" value="yes" required />
        <span>
          I agree to Before the Bell using these details and the information I share in this form to assess the NBFC and arrange funding, as set
          out in the <a href="/private-credit/privacy" target="_blank" rel="noreferrer">privacy notice</a>.
        </span>
      </label>
      {state?.error && <div className="msg error" role="alert">{state.error}</div>}
      <div>
        <PendingButton pendingText="Starting…">Continue to the form</PendingButton>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        We&apos;ll email you a link back to the form. Your answers save as you go.
      </p>
    </form>
  );
}
