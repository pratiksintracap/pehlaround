"use client";

import { useState } from "react";
import { RegistrySuggest, type RegistryRow } from "@/components/credit/app/RegistryLookup";

/** Name, CIN, RBI registration and state. Typing a name or a CIN offers the match from RBI's register to fill the rest. */
export function IdentityFields({ b }: { b?: { name: string; cin: string | null; rbiRegistration: string | null; city: string | null; state: string | null } }) {
  const [name, setName] = useState(b?.name ?? "");
  const [cin, setCin] = useState(b?.cin ?? "");
  const [rbi, setRbi] = useState(b?.rbiRegistration ?? "");
  const [state, setState] = useState(b?.state ?? "");
  const pick = (r: RegistryRow) => {
    setName(r.name);
    if (r.cin) setCin(r.cin);
    if (r.rbiRegNo) setRbi(r.rbiRegNo);
    if (r.state) setState(r.state);
  };
  return (
    <>
      <div className="row">
        <label>
          Name
          <input name="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <RegistrySuggest query={name} onPick={pick} />
        </label>
        <label>
          CIN
          <input name="cin" value={cin} onChange={(e) => setCin(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={21} autoComplete="off" />
          <RegistrySuggest query={cin} onPick={pick} autoPickCin />
        </label>
        <label>RBI registration no.<input name="rbiRegistration" value={rbi} onChange={(e) => setRbi(e.target.value)} /></label>
        <label>State<input name="state" value={state} onChange={(e) => setState(e.target.value)} /></label>
      </div>
      <p className="muted small" style={{ margin: "-0.3rem 0 0" }}>
        Type the name or the CIN: the match from RBI&apos;s register fills in the rest. RBI&apos;s list rarely includes the registration number.
      </p>
    </>
  );
}
