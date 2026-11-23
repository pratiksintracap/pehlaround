import { IdentityFields } from "./IdentityFields";

type Seg = { id: string; name: string };
type Borrower = {
  name: string;
  cin: string | null;
  rbiRegistration: string | null;
  city: string | null;
  state: string | null;
  status: string;
  drawdownCycle: string;
  notes: string | null;
};

export function BorrowerFields({ segments, b, segmentIds = [] }: { segments: Seg[]; b?: Borrower; segmentIds?: string[] }) {
  return (
    <>
      <IdentityFields b={b} />
      <div className="row">
        <label>City<input name="city" defaultValue={b?.city ?? ""} /></label>
        <label>
          Status
          <select name="status" defaultValue={b?.status ?? "prospect"}>
            <option value="prospect">Prospect</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label>
          Drawdown cycle
          <select name="drawdownCycle" defaultValue={b?.drawdownCycle ?? "monthly"}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <span className="small muted">New raises use this cycle; existing raises keep theirs.</span>
        </label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted">Loan-book segments (used to match lender thesis)</legend>
        {segments.length === 0 ? (
          <p className="small muted">No segments defined yet. Add them in Settings.</p>
        ) : (
          <div className="inline">
            {segments.map((s) => (
              <label className="check" key={s.id}>
                <input type="checkbox" name="segment" value={s.id} defaultChecked={segmentIds.includes(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label>Internal notes (platform team only)<textarea name="notes" defaultValue={b?.notes ?? ""} /></label>
    </>
  );
}
