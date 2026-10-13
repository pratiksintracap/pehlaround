"use client";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { assess, summary, fmtCr, PE_BANDS, type Inputs, type Years, type Check } from "@/lib/readiness";

const SECTORS = Object.keys(PE_BANDS);
const ROWS: [keyof Pick<Inputs, "rev" | "ebitda" | "pat" | "nw">, string][] = [["rev", "Revenue"], ["ebitda", "EBITDA"], ["pat", "Profit after tax"], ["nw", "Net worth"]];
const GOV: [keyof Inputs["gov"], string][] = [
  ["publicLtd", "Already a public limited company"], ["peerAuditor", "Peer-reviewed auditor"], ["board", "Independent directors on the board"],
  ["promoter", "Promoters hold the majority"], ["clean", "No defaults or regulatory actions"],
];
const SAMPLE: Partial<Inputs> = { sector: "Manufacturing and engineering", track: "over5", rev: [142, 188, 241], ebitda: [17, 24, 33], pat: [9, 13, 19], nw: [61, 74, 93], nta: 88, debt: 46, capital: 6, gov: { publicLtd: false, peerAuditor: true, board: false, promoter: true, clean: true } };
const empty = (): Inputs => ({ company: "", sector: "", track: "3to5", rev: [null, null, null], ebitda: [null, null, null], pat: [null, null, null], nw: [null, null, null], nta: null, debt: null, capital: null, gov: { publicLtd: false, peerAuditor: false, board: false, promoter: true, clean: true } });
const num = (s: string) => (s.trim() === "" || isNaN(+s) ? null : +s);
const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "" : "−"}${Math.abs(Math.round(v * 100))}%`);

function Ring({ v }: { v: number }) {
  const r = 46, c = 2 * Math.PI * r, tone = v >= 70 ? "var(--live)" : v >= 45 ? "var(--amber)" : "var(--bad)";
  return (
    <svg className="rd-ring" viewBox="0 0 110 110" role="img" aria-label={`Readiness score ${v} out of 100`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 55 55)" />
      <text x="55" y="58" textAnchor="middle" className="rd-ring-v">{v}</text><text x="55" y="76" textAnchor="middle" className="rd-ring-s">out of 100</text>
    </svg>
  );
}
const Mark = ({ ok }: { ok: boolean | null }) => <span className={`rd-mk ${ok === true ? "y" : ok === false ? "n" : "q"}`} aria-label={ok === true ? "Meets" : ok === false ? "Does not meet" : "To confirm"}>{ok === true ? "✓" : ok === false ? "✕" : "?"}</span>;
const Checks = ({ cs }: { cs: Check[] }) => <ul className="rd-checks">{cs.map((c) => <li key={c.id}><Mark ok={c.ok} /><div><b>{c.label}</b><small>{c.note}</small></div></li>)}</ul>;

export function Readiness({ intro }: { intro: ReactNode }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [v, setV] = useState<Inputs>(empty);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const rep = useRef<HTMLElement>(null);
  const r = useMemo(() => (step === 3 ? assess(v) : null), [step, v]);

  const setYear = (k: keyof Inputs, i: number, s: string) => { setRaw((o) => ({ ...o, [`${k}${i}`]: s })); setV((o) => { const a = [...(o[k] as Years)] as Years; a[i] = num(s); return { ...o, [k]: a }; }); };
  const setOne = (k: "nta" | "debt" | "capital", s: string) => { setRaw((o) => ({ ...o, [k]: s })); setV((o) => ({ ...o, [k]: num(s) })); };
  const sample = () => {
    const s = { ...empty(), ...SAMPLE, company: v.company } as Inputs; setV(s);
    const m: Record<string, string> = {}; ROWS.forEach(([k]) => (s[k] as Years).forEach((x, i) => (m[`${k}${i}`] = String(x)))); (["nta", "debt", "capital"] as const).forEach((k) => (m[k] = String(s[k])));
    setRaw(m); setErr("");
  };
  const go = () => {
    if (!v.sector) return setErr("Pick the sector.");
    if (v.rev[2] === null || v.ebitda.some((x) => x === null) || v.pat[2] === null || v.nw.some((x) => x === null)) return setErr("Fill in revenue and PAT for FY26, and EBITDA and net worth for all three years.");
    setErr(""); setStep(3); setTimeout(() => rep.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const send = () => {
    if (!r) return;
    const f = document.getElementById("founder") as HTMLFormElement | null; if (!f) return;
    const set = (name: string, val: string) => { const el = f.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null; if (el) el.value = val; };
    const rv = v.rev[2] ?? 0, p = v.pat[2] ?? 0;
    set("entity", v.company); set("category", v.sector);
    set("ticket", rv < 25 ? "Under ₹25 Cr" : rv < 100 ? "₹25–100 Cr" : rv < 500 ? "₹100–500 Cr" : "Above ₹500 Cr");
    set("pat", p <= 0 ? "Loss or break-even" : p < 5 ? "Under ₹5 Cr" : p <= 25 ? "₹5–25 Cr" : "Above ₹25 Cr");
    set("listing", r.route === "main" ? "Within 24 months, main board" : r.route === "sme" ? "Within 24 months, SME" : r.route === "qib" ? "24–36 months" : "Not decided");
    set("report", summary(v, r));
    const note = f.querySelector(".rd-attached"); if (note) note.removeAttribute("hidden");
    f.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => (f.elements.namedItem("name") as HTMLInputElement | null)?.focus({ preventScroll: true }), 500);
  };

  return (
    <>
      <div className="wrap split rd-hero">
        <div className="rv inview">{intro}</div>
        <div className="rv inview" style={{ ["--d" as string]: ".1s" }}>
          <div className="rd-card" id="check">
            <div className="rd-top"><span className="rd-badge">Free IPO readiness check</span><span className="mono rd-step">{step === 1 ? "1/2" : "2/2"}</span></div>
            {step === 1 ? (
              <form className="form rd-f1" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                <h3>Is your company ready to list?</h3>
                <p className="fine">SME or main board, what to fix first, an indicative value at listing and a timeline, in about two minutes.</p>
                <label className="rd-lbl">Company name or website<input name="rd-company" value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} placeholder="e.g. acmeindustries.in" autoComplete="organization" /></label>
                <button className="btn primary rd-next" type="submit">Next</button>
                <p className="rd-priv">No email or sign-up. It is worked out in your browser; nothing is sent unless you choose to.</p>
              </form>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); go(); }} className="form rd-form">
                <div className="row">
                  <label>Sector<select value={v.sector} onChange={(e) => setV({ ...v, sector: e.target.value })} name="rd-sector"><option value="" disabled>Select</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></label>
                  <label>Operating track record<select value={v.track} onChange={(e) => setV({ ...v, track: e.target.value as Inputs["track"] })} name="rd-track"><option value="under3">Under 3 years</option><option value="3to5">3–5 years</option><option value="over5">Over 5 years</option></select></label>
                </div>
                <div className="rd-grid" role="group" aria-label="Financials in ₹ crore">
                  <span className="mono">₹ Cr</span><span className="mono">FY24</span><span className="mono">FY25</span><span className="mono">FY26</span>
                  {ROWS.map(([k, l]) => [
                    <b key={k}>{l}</b>,
                    ...[0, 1, 2].map((i) => <input key={k + i} type="number" step="any" inputMode="decimal" name={`rd-${k}${i}`} aria-label={`${l} FY${24 + i}`} value={raw[`${k}${i}`] ?? ""} onChange={(e) => setYear(k, i, e.target.value)} />),
                  ])}
                </div>
                <div className="row3">
                  <label>Net tangible assets<input type="number" step="any" inputMode="decimal" name="rd-nta" value={raw.nta ?? ""} onChange={(e) => setOne("nta", e.target.value)} placeholder="₹ Cr" /></label>
                  <label>Total debt<input type="number" step="any" inputMode="decimal" name="rd-debt" value={raw.debt ?? ""} onChange={(e) => setOne("debt", e.target.value)} placeholder="₹ Cr" /></label>
                  <label>Paid-up capital<input type="number" step="any" inputMode="decimal" name="rd-capital" value={raw.capital ?? ""} onChange={(e) => setOne("capital", e.target.value)} placeholder="₹ Cr" /></label>
                </div>
                <div className="chips">{GOV.map(([k, l]) => <label key={k} className="chipbox"><input type="checkbox" name={`rd-${k}`} checked={v.gov[k]} onChange={(e) => setV({ ...v, gov: { ...v.gov, [k]: e.target.checked } })} /><span>{l}</span></label>)}</div>
                {err && <p className="ok show bad" role="alert">{err}</p>}
                <div className="rd-acts"><button className="btn primary" type="submit">See my readiness report</button>
                  <button type="button" className="linkbtn" onClick={() => setStep(1)}>Back</button><button type="button" className="linkbtn" onClick={sample}>Try sample numbers</button></div>
              </form>
            )}
          </div>
        </div>
      </div>

      {r && (
        <section className="rd-report wrap" ref={rep} id="report" aria-label="Readiness report">
          <div className="rd-head">
            <Ring v={r.score} />
            <div>
              <span className="eyebrow">Readiness report{v.company ? ` · ${v.company}` : ""}</span>
              <h2 className="tt">{r.routeLabel}<span className="tt2">{r.route === "notyet" ? "Here is what stands in the way." : "Here is what it would take."}</span></h2>
              <p className="rd-note">{r.routeNote}</p>
            </div>
          </div>
          <div className="rd-tiles">
            <div className="rd-tile rd-val">
              <span className="k">Indicative value at listing</span>
              {r.value ? <><b>{fmtCr(r.value.lo)} – {fmtCr(r.value.hi)}</b><small>FY26 PAT {fmtCr(r.value.pat)} × {r.value.pe[0]}–{r.value.pe[1]}x, the trailing P/E range of listed {v.sector.toLowerCase()} peers. A pre-IPO round prices below this; the desk works out where with you.</small></>
                : <><b>Needs a profit</b><small>Listing values here run off profit after tax. With a loss in FY26, the desk would look at revenue multiples and the path to profit instead.</small></>}
            </div>
            <div className="rd-tile"><span className="k">Revenue growth</span><b>{pct(r.cagr)}</b><small>a year, FY24 to FY26</small></div>
            <div className="rd-tile"><span className="k">PAT margin</span><b>{pct(r.margin)}</b><small>in FY26</small></div>
            <div className="rd-tile"><span className="k">Debt to equity</span><b>{v.debt !== null && v.nw[2] ? `${(v.debt / v.nw[2]).toFixed(2)}x` : "—"}</b><small>at the end of FY26</small></div>
          </div>
          <ol className="rd-time" aria-label="Indicative timeline">{r.timeline.map((t, i) => <li key={i}><i /><b>{t.label}</b><small>{t.when}</small></li>)}</ol>
          <div className="rd-cols">
            <div className="rd-col"><h3>SME platform tests</h3><Checks cs={r.sme} /></div>
            <div className="rd-col"><h3>Main-board tests</h3><Checks cs={r.main} /></div>
            <div className="rd-col"><h3>Governance</h3><Checks cs={r.gov} /></div>
          </div>
          {(r.gaps.length > 0 || r.upgrade.length > 0) && (
            <div className="rd-cols two">
              {r.gaps.length > 0 && <div className="rd-col rd-fix"><h3>What to fix first</h3><ol>{r.gaps.map((g) => <li key={g}>{g}</li>)}</ol></div>}
              {r.upgrade.length > 0 && <div className="rd-col"><h3>To move up to the main board</h3><ol>{r.upgrade.map((g) => <li key={g}>{g}</li>)}</ol></div>}
            </div>
          )}
          <div className="rd-cta">
            <div><b>Send this report to the desk</b><p>A banker reads it and calls within two working days to tell you what the desk could do: a pre-IPO round with family offices, an SME anchor, or what to fix first.</p></div>
            <div className="rd-cta-b"><button className="btn primary" type="button" onClick={send}>Send it to the desk</button>
              <button className="btn" type="button" onClick={() => { setStep(2); document.getElementById("check")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Edit the numbers</button>
              <button className="btn ghost" type="button" onClick={() => window.print()}>Save as PDF</button></div>
          </div>
          <p className="fine rd-disc">Indicative only, from the numbers you entered; not advice, an offer or a valuation. The tests simplify SEBI&apos;s ICDR rules for main-board issues, its 2025 SME amendments and the norms of BSE SME and NSE Emerge, which also look at restated accounts, free cash flow and promoter history. P/E ranges are broad sector ranges for listed Indian small and mid caps; the desk replaces them with a live peer set.</p>
        </section>
      )}
    </>
  );
}
