import { DEAL_STAGES, FACILITIES } from "@/lib/credit/server/admin/direct-deals";
import { STAGE_LABEL } from "./labels";

type D = Partial<Record<string, string | number | null>>;

/** The deal form, shared by "Add a deal" and the deal page. */
export function DealFields({ d = {} }: { d?: D }) {
  const v = (k: string) => (d[k] == null ? "" : String(d[k]));
  return (
    <>
      <div className="row">
        <label>Company<input name="companyName" required maxLength={200} defaultValue={v("companyName")} /></label>
        <label>Amount needed (₹ Cr)<input name="amountCr" required inputMode="decimal" defaultValue={v("amountCr")} placeholder="e.g. 40" /></label>
        <label>
          Stage
          <select name="stage" defaultValue={v("stage") || "lead"}>
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Facility
          <select name="facility" defaultValue={v("facility")}>
            <option value="">Not decided</option>
            {FACILITIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label>Tenor (months)<input name="tenorMonths" inputMode="numeric" defaultValue={v("tenorMonths")} /></label>
        <label>Rate expected<input name="rateExpectation" maxLength={100} defaultValue={v("rateExpectation")} placeholder="e.g. 11–12% p.a." /></label>
      </div>
      <label>What the money is for<textarea name="purpose" maxLength={2000} defaultValue={v("purpose")} /></label>
      <label>Security offered<textarea name="security" maxLength={2000} defaultValue={v("security")} placeholder="e.g. First charge on plant and machinery, 1.25x cover, personal guarantee" /></label>
      <div className="row">
        <label>Sector<input name="sector" maxLength={200} defaultValue={v("sector")} /></label>
        <label>CIN<input name="cin" maxLength={30} defaultValue={v("cin")} /></label>
        <label>City<input name="city" maxLength={100} defaultValue={v("city")} /></label>
        <label>State<input name="state" maxLength={100} defaultValue={v("state")} /></label>
      </div>
      <div className="row">
        <label>Contact name<input name="contactName" maxLength={200} defaultValue={v("contactName")} /></label>
        <label>Role<input name="contactRole" maxLength={200} defaultValue={v("contactRole")} /></label>
        <label>Email<input name="contactEmail" type="email" maxLength={200} defaultValue={v("contactEmail")} /></label>
        <label>Phone<input name="contactPhone" maxLength={50} defaultValue={v("contactPhone")} /></label>
      </div>
      <div className="row">
        <label>Source<input name="source" maxLength={300} defaultValue={v("source")} placeholder="Who brought it" /></label>
        <label>Next step<input name="nextStep" maxLength={500} defaultValue={v("nextStep")} /></label>
        <label>By<input name="nextStepOn" type="date" defaultValue={v("nextStepOn")} /></label>
      </div>
      <label>Notes (team only)<textarea name="notes" maxLength={8000} defaultValue={v("notes")} /></label>
    </>
  );
}
