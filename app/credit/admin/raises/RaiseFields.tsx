import { cycleName } from "@/lib/credit/server/cycles";

type Level = { id: string; name: string };
type Defaults = {
  cycleStart?: string;
  instrumentId?: string | null;
  segmentId?: string | null;
  purpose?: string | null;
  expectedRateMin?: string | null;
  expectedRateMax?: string | null;
  amount?: string;
  lenderRate?: string | null;
  borrowerRate?: string | null;
  securityLevelId?: string | null;
  securityDescription?: string | null;
  terms?: string | null;
};

/**
 * One rate per raise for every lender (parity). The borrower rate and the spread between them stay with the
 * platform team: lenders never see them.
 */
export function RaiseFields({
  securityLevels,
  instruments = [],
  segments = [],
  defaults = {},
  locked = false,
  cycleLocked = false,
  cycle,
}: {
  securityLevels: Level[];
  instruments?: Level[];
  segments?: Level[];
  defaults?: Defaults;
  /** After a sanction: rate, security and terms are shown read-only (the server enforces this too). */
  locked?: boolean;
  cycleLocked?: boolean;
  /** The drawdown cycle this raise uses: the borrower's for a new raise, the raise's own once created. */
  cycle: string;
}) {
  return (
    <>
      <div className="row">
        <label>
          Period start month
          <input name="cycleStart" type="month" required readOnly={cycleLocked} defaultValue={defaults.cycleStart?.slice(0, 7)} />
          <span className="small muted">{cycleName(cycle)} cycle</span>
        </label>
        <label>Amount requested (₹)<input name="amount" inputMode="decimal" required defaultValue={defaults.amount ?? ""} /></label>
        <label>
          Instrument
          {locked && <input type="hidden" name="instrumentId" value={defaults.instrumentId ?? ""} />}
          <select name={locked ? undefined : "instrumentId"} disabled={locked} defaultValue={defaults.instrumentId ?? ""}>
            <option value="">Not set</option>
            {instruments.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Segment funded
          {locked && <input type="hidden" name="segmentId" value={defaults.segmentId ?? ""} />}
          <select name={locked ? undefined : "segmentId"} disabled={locked} defaultValue={defaults.segmentId ?? ""}>
            <option value="">Not set</option>
            {segments.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label>Borrower&apos;s expected rate band from (% p.a., platform only)<input name="expectedRateMin" inputMode="decimal" defaultValue={defaults.expectedRateMin ?? ""} /></label>
        <label>to (% p.a.)<input name="expectedRateMax" inputMode="decimal" defaultValue={defaults.expectedRateMax ?? ""} /></label>
      </div>
      <label>Purpose of funds<textarea name="purpose" readOnly={locked} defaultValue={defaults.purpose ?? ""} /></label>
      <div className="row">
        <label>Lender rate (% p.a., same for every lender)<input name="lenderRate" inputMode="decimal" readOnly={locked} defaultValue={defaults.lenderRate ?? ""} /></label>
        <label>Borrower rate (% p.a., platform only)<input name="borrowerRate" inputMode="decimal" defaultValue={defaults.borrowerRate ?? ""} /></label>
      </div>
      <div className="row">
        <label>
          Security level
          {locked && <input type="hidden" name="securityLevelId" value={defaults.securityLevelId ?? ""} />}
          <select name={locked ? undefined : "securityLevelId"} disabled={locked} defaultValue={defaults.securityLevelId ?? ""}>
            <option value="">Not set</option>
            {securityLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      <label>Security offered (same package for every lender)<textarea name="securityDescription" readOnly={locked} defaultValue={defaults.securityDescription ?? ""} /></label>
      <label>Terms (shared with lenders on this raise)<textarea name="terms" readOnly={locked} defaultValue={defaults.terms ?? ""} /></label>
    </>
  );
}
