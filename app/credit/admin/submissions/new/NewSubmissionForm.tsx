"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { RegistrySuggest } from "@/components/credit/app/RegistryLookup";
import { createSubmissionForPartnerAction } from "../../actions";

export function NewSubmissionForm({ partners }: { partners: { id: string; name: string }[] }) {
  const [partner, setPartner] = useState(partners[0]?.id ?? "new");
  const [company, setCompany] = useState("");
  const [cin, setCin] = useState("");
  return (
    <ActionForm action={createSubmissionForPartnerAction} className="stack">
      <div className="row">
        <label>Partner
          <select name="partnerId" value={partner} onChange={(e) => setPartner(e.target.value)}>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="new">A new partner…</option>
          </select>
        </label>
        {partner === "new" && <label>New partner&apos;s firm name<input name="newPartner" required maxLength={200} /></label>}
      </div>
      <div className="row">
        <label>NBFC&apos;s name
          <input name="companyName" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
          <RegistrySuggest query={company} onPick={(r) => { setCompany(r.name); if (r.cin) setCin(r.cin); }} />
        </label>
        <label>CIN (optional)
          <input name="cin" maxLength={21} value={cin} onChange={(e) => setCin(e.target.value.toUpperCase().replace(/\s/g, ""))} autoComplete="off" />
          <RegistrySuggest query={cin} onPick={(r) => { setCompany(r.name); if (r.cin) setCin(r.cin); }} autoPickCin />
        </label>
      </div>
      <div><Submit>Create and continue</Submit></div>
    </ActionForm>
  );
}
