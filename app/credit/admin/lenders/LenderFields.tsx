type Item = { id: string; name: string };
type Lender = {
  name: string;
  minTicket: string | null;
  maxTicket: string | null;
  minRate: string | null;
  maxRate: string | null;
  thesisNotes: string | null;
  active: boolean;
};

/** Lender profile: thesis (segments and exposure targets), ticket size, rate band, risk appetite. All values entered by the team. */
export function LenderFields({
  segments,
  securityLevels,
  instruments = [],
  instrumentIds = [],
  l,
  targets = [],
  securityLevelIds = [],
}: {
  segments: Item[];
  securityLevels: Item[];
  instruments?: Item[];
  instrumentIds?: string[];
  l?: Lender;
  targets?: { segmentId: string; targetExposure: string | null }[];
  securityLevelIds?: string[];
}) {
  return (
    <>
      <div className="row">
        <label>Lender name<input name="name" required defaultValue={l?.name} /></label>
        <label className="check" style={{ alignSelf: "end" }}>
          <input type="checkbox" name="active" defaultChecked={l?.active ?? true} /> Active (included in matching)
        </label>
      </div>
      <div className="row">
        <label>Minimum ticket (₹)<input name="minTicket" inputMode="decimal" defaultValue={l?.minTicket ?? ""} /></label>
        <label>Maximum ticket (₹)<input name="maxTicket" inputMode="decimal" defaultValue={l?.maxTicket ?? ""} /></label>
        <label>Rate band from (% p.a.)<input name="minRate" inputMode="decimal" defaultValue={l?.minRate ?? ""} /></label>
        <label>Rate band to (% p.a.)<input name="maxRate" inputMode="decimal" defaultValue={l?.maxRate ?? ""} /></label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted">Thesis: segments this lender wants exposure to, with an optional exposure target (measured on amount outstanding)</legend>
        {segments.length === 0 ? (
          <p className="small muted">No segments defined yet. Add them in Settings.</p>
        ) : (
          <table>
            <tbody>
              {segments.map((s) => {
                const t = targets.find((x) => x.segmentId === s.id);
                return (
                  <tr key={s.id}>
                    <td style={{ width: "40%" }}>
                      <label className="check"><input type="checkbox" name="segment" value={s.id} defaultChecked={!!t} /> {s.name}</label>
                    </td>
                    <td>
                      <input name={`target_${s.id}`} inputMode="decimal" placeholder="Exposure target (₹, optional)" defaultValue={t?.targetExposure ?? ""} aria-label={`${s.name} exposure target`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted">Risk appetite: security levels this lender will take</legend>
        {securityLevels.length === 0 ? (
          <p className="small muted">No security levels defined yet. Add them in Settings.</p>
        ) : (
          <div className="inline">
            {securityLevels.map((s) => (
              <label className="check" key={s.id}>
                <input type="checkbox" name="securityLevel" value={s.id} defaultChecked={securityLevelIds.includes(s.id)} /> {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted">Instruments this lender&apos;s mandate allows</legend>
        {instruments.length === 0 ? (
          <p className="small muted">No instruments defined yet. Add them in Settings.</p>
        ) : (
          <div className="inline">
            {instruments.map((s) => (
              <label className="check" key={s.id}>
                <input type="checkbox" name="instrument" value={s.id} defaultChecked={instrumentIds.includes(s.id)} /> {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label>Thesis notes<textarea name="thesisNotes" defaultValue={l?.thesisNotes ?? ""} /></label>
    </>
  );
}
