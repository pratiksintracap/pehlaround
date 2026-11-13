/*
 * Explanatory diagrams. All of them are illustrative: no real borrowers, lenders, amounts or rates.
 * "Lender A", "Borrower 1" and similar are generic labels only.
 * Drawing language: ink strokes for structure, brass for the path a raise takes, dashed rule for "not shared".
 */

type Desc = { title: string; desc: string };

function Frame({ title, desc, viewBox, children, className = "" }: Desc & { viewBox: string; children: React.ReactNode; className?: string }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <svg className={`dg ${className}`} viewBox={viewBox} role="img" aria-labelledby={`${id}-t ${id}-d`}>
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      <defs>
        <marker id="arrow-brass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--cr-accent)" />
        </marker>
        <marker id="arrow-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--cr-ink)" />
        </marker>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--cr-rule2)" strokeWidth="2" />
        </pattern>
      </defs>
      {children}
    </svg>
  );
}

/** Small labelled box. */
function Box({ x, y, w, h, label, sub, tone = "plain" }: { x: number; y: number; w: number; h: number; label: string; sub?: string; tone?: "plain" | "ink" | "muted" | "brass" }) {
  return (
    <g className={`dg-box dg-${tone}`}>
      <rect x={x} y={y} width={w} height={h} rx="4" />
      <text x={x + w / 2} y={sub ? y + h / 2 - 3 : y + h / 2 + 5} textAnchor="middle" className="dg-label">{label}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" className="dg-sub">{sub}</text>}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Home hero: borrowers, the desk with its three filters, lenders.     */
/* ------------------------------------------------------------------ */
export function HeroNetwork() {
  const borrowers = [70, 170, 270];
  const lenders = [
    { y: 40, matched: true },
    { y: 120, matched: false },
    { y: 200, matched: true },
    { y: 280, matched: true },
  ];
  return (
    <Frame
      viewBox="0 0 520 360"
      title="How the debt desk takes a company's requirement to the lenders that fit"
      desc="A company's requirement on the left goes to the debt desk, which prepares the credit pack and checks sector fit, size and security. It then goes only to the lenders on the right that fit; one lender in the picture is not a fit and is not approached."
      className="dg-hero"
    >
      <text x="10" y="20" className="dg-caption">Your requirement</text>
      <text x="510" y="20" textAnchor="end" className="dg-caption">Lenders</text>
      {borrowers.map((y, i) => (
        <g key={y}>
          <Box x={10} y={y - 22} w={112} h={44} label={["Term loan", "Working capital", "NCD or CP"][i]} />
          <path d={`M122 ${y} C 160 ${y}, 160 180, 188 180`} className="dg-flow" />
        </g>
      ))}
      {/* the desk */}
      <g className="dg-desk">
        <rect x="188" y="62" width="144" height="236" rx="6" />
        <text x="260" y="88" textAnchor="middle" className="dg-label on-ink">The debt desk</text>
        <text x="260" y="106" textAnchor="middle" className="dg-sub on-ink">Credit pack, structure</text>
        {["Sector fit", "Size", "Security"].map((g, i) => (
          <g key={g}>
            <rect x="204" y={128 + i * 52} width="112" height="38" rx="3" className="dg-gate" />
            <text x="260" y={152 + i * 52} textAnchor="middle" className="dg-label">{g}</text>
          </g>
        ))}
      </g>
      {lenders.map((l, i) => (
        <g key={l.y}>
          <path
            d={`M332 180 C 368 180, 368 ${l.y + 22}, 398 ${l.y + 22}`}
            className={l.matched ? "dg-flow" : "dg-unshared"}
            markerEnd={l.matched ? "url(#arrow-brass)" : undefined}
          />
          <Box x={398} y={l.y} w={112} h={44} label={["Bank", "NBFC", "Credit fund", "Family office"][i]} sub={l.matched ? "A fit" : "Not a fit"} tone={l.matched ? "plain" : "muted"} />
        </g>
      ))}
      {/* One cycle every 6 s: raises travel into the desk, pass the three gates, and leave only for matched lenders. */}
      <g className="dg-motion" aria-hidden="true">
        {borrowers.map((y, i) => (
          <circle key={`in-${y}`} r="5" className="dg-token" opacity="0">
            <animateMotion dur="6s" begin={`2s+${i * 0.18}s`} repeatCount="indefinite" path={`M122 ${y} C 160 ${y}, 160 180, 188 180`} keyPoints="0;1;1" keyTimes="0;0.2;1" calcMode="linear" />
            <animate attributeName="opacity" dur="6s" begin={`2s+${i * 0.18}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.03;0.18;0.21;1" />
          </circle>
        ))}
        {["Sector fit", "Size", "Security"].map((g, i) => (
          <rect key={`glow-${g}`} x="204" y={128 + i * 52} width="112" height="38" rx="3" className="dg-gate-glow" opacity="0">
            <animate attributeName="opacity" dur="6s" begin="2s" repeatCount="indefinite" values="0;0;0.9;0;0" keyTimes={`0;${(0.22 + i * 0.09).toFixed(2)};${(0.27 + i * 0.09).toFixed(2)};${(0.36 + i * 0.09).toFixed(2)};1`} />
          </rect>
        ))}
        {lenders.filter((l) => l.matched).map((l, i) => (
          <g key={`out-${l.y}`}>
            <circle r="5" className="dg-token" opacity="0">
              <animateMotion dur="6s" begin={`2s+${i * 0.12}s`} repeatCount="indefinite" path={`M332 180 C 368 180, 368 ${l.y + 22}, 398 ${l.y + 22}`} keyPoints="0;0;1;1" keyTimes="0;0.52;0.72;1" calcMode="linear" />
              <animate attributeName="opacity" dur="6s" begin={`2s+${i * 0.12}s`} repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.51;0.54;0.7;0.73;1" />
            </circle>
            <rect x="398" y={l.y} width="112" height="44" rx="4" className="dg-arrive" opacity="0">
              <animate attributeName="opacity" dur="6s" begin={`2s+${i * 0.12}s`} repeatCount="indefinite" values="0;0;1;0;0" keyTimes="0;0.71;0.75;0.86;1" />
            </rect>
          </g>
        ))}
      </g>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Recurring drawdowns on each borrower's own cycle.                   */
/* ------------------------------------------------------------------ */
export function CyclesDiagram() {
  const rows: { label: string; every: number }[] = [
    { label: "Monthly", every: 1 },
    { label: "Quarterly", every: 3 },
    { label: "Yearly", every: 12 },
  ];
  const x0 = 120;
  const step = 31;
  return (
    <Frame
      viewBox="0 0 520 230"
      title="Drawdowns on each borrower's own cycle"
      desc="Three borrowers over the same twelve months. One draws down monthly, one quarterly and one yearly. Each drawdown builds on the same diligence file."
    >
      <text x={x0} y="22" className="dg-caption">Twelve months</text>
      {Array.from({ length: 12 }, (_, m) => (
        <line key={m} x1={x0 + m * step + 8} x2={x0 + m * step + 8} y1="36" y2="206" className="dg-tick" />
      ))}
      {rows.map((r, i) => {
        const y = 66 + i * 60;
        return (
          <g key={r.label}>
            <text x="10" y={y + 5} className="dg-label">{r.label}</text>
            <line x1={x0} x2={x0 + 12 * step} y1={y} y2={y} className="dg-line" />
            {Array.from({ length: 12 }, (_, m) =>
              m % r.every === 0 ? (
                <g key={m}>
                  <rect x={x0 + m * step} y={y - 12} width="16" height="24" rx="2" className="dg-drawdown" />
                </g>
              ) : null,
            )}
          </g>
        );
      })}
      <g transform="translate(120 222)">
        <rect x="0" y="-9" width="10" height="12" rx="2" className="dg-drawdown" />
        <text x="16" y="1" className="dg-sub">A drawdown</text>
      </g>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Sell-down: one raise split across lenders at parity.                */
/* ------------------------------------------------------------------ */
export function SellDownDiagram() {
  const parts = [
    { w: 120, label: "Lender A" },
    { w: 96, label: "Lender B" },
    { w: 84, label: "Lender C" },
  ];
  let x = 20;
  return (
    <Frame
      viewBox="0 0 520 220"
      title="One raise sold down across lenders at parity"
      desc="A single raise is split into parts taken by different lenders, with part of the raise still open. Every part carries the same security, the same terms and the same rate."
    >
      <text x="20" y="26" className="dg-caption">One raise</text>
      {parts.map((p) => {
        const px = x;
        x += p.w;
        return (
          <g key={p.label}>
            <rect x={px} y="40" width={p.w} height="56" className="dg-part" />
            <text x={px + p.w / 2} y="73" textAnchor="middle" className="dg-label on-ink">{p.label}</text>
          </g>
        );
      })}
      <rect x={x} y="40" width={500 - x} height="56" fill="url(#hatch)" className="dg-open" />
      <text x={(x + 500) / 2} y="73" textAnchor="middle" className="dg-label">Still open</text>
      <rect x="20" y="40" width="480" height="56" className="dg-outline" />
      {/* parity bracket */}
      <path d={`M20 112 v10 H${x} v-10`} className="dg-bracket" />
      <text x={(20 + x) / 2} y="146" textAnchor="middle" className="dg-label">Same security, same terms, same rate</text>
      <text x={(20 + x) / 2} y="168" textAnchor="middle" className="dg-sub">for every lender in the raise</text>
      <text x="20" y="206" className="dg-sub">Each lender sees the total and how much is filled, not who the other lenders are.</text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Diligence uploaded once, read by every matched lender.              */
/* ------------------------------------------------------------------ */
export function DiligenceOnceDiagram() {
  return (
    <Frame
      viewBox="0 0 520 250"
      title="Company diligence hosted once, read by each matched lender"
      desc="A borrower's company diligence is collected once and held online. It is screened by the platform at Level 1 and then shared with each lender matched to the raise, who uses the same files for its own Level 2 diligence."
    >
      {/* document stack */}
      {[16, 8, 0].map((o) => (
        <rect key={o} x={30 + o} y={40 + o} width="120" height="150" rx="4" className="dg-doc" />
      ))}
      {[78, 96, 114, 132, 150].map((y) => (
        <line key={y} x1="62" x2={y % 36 ? 160 : 130} y1={y + 16} y2={y + 16} className="dg-docline" />
      ))}
      <text x="106" y="228" textAnchor="middle" className="dg-label">Company diligence</text>
      <text x="106" y="246" textAnchor="middle" className="dg-sub">collected once, kept current</text>
      {/* level 1 stamp */}
      <g className="dg-stamp">
        <rect x="200" y="98" width="110" height="44" rx="22" />
        <text x="255" y="125" textAnchor="middle" className="dg-label">Level 1</text>
      </g>
      <path d="M166 120 H200" className="dg-flow" />
      {[50, 120, 190].map((y, i) => (
        <g key={y}>
          <path d={`M310 120 C 350 120, 350 ${y + 20}, 380 ${y + 20}`} className="dg-flow" markerEnd="url(#arrow-brass)" />
          <Box x={380} y={y} w={130} h={40} label={`Lender ${"ABC"[i]}`} sub="Level 2" />
        </g>
      ))}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Lender view: raises pass three filters before reaching deal flow.   */
/* ------------------------------------------------------------------ */
export function MatchFunnel() {
  // Columns of dots that thin out after each gate.
  const stages = [
    { x: 40, n: 12 },
    { x: 170, n: 8 },
    { x: 300, n: 5 },
    { x: 430, n: 3 },
  ];
  const gates = ["Thesis", "Rate band", "Risk appetite"];
  return (
    <Frame
      viewBox="0 0 520 260"
      title="Deal flow filtered to a lender's book"
      desc="Many raises on the left pass three filters in turn: the lender's thesis, its rate band and its risk appetite. Only the few raises that pass all three reach the lender's deal flow on the right."
    >
      {stages.map((s, i) => (
        <g key={s.x}>
          {Array.from({ length: s.n }, (_, k) => (
            <circle
              key={k}
              cx={s.x + (k % 3) * 18}
              cy={70 + Math.floor(k / 3) * 26}
              r="7"
              className={i === stages.length - 1 ? "dg-dot-brass" : "dg-dot"}
            />
          ))}
        </g>
      ))}
      {gates.map((g, i) => {
        const gx = 118 + i * 130;
        return (
          <g key={g}>
            <rect x={gx} y="44" width="10" height="132" rx="2" className="dg-gate-bar" />
            <text x={gx + 5} y="204" textAnchor="middle" className="dg-label">{g}</text>
          </g>
        );
      })}
      <text x="40" y="34" className="dg-caption">Raises on the platform</text>
      <text x="490" y="34" textAnchor="end" className="dg-caption">Your deal flow</text>
      <text x="260" y="244" textAnchor="middle" className="dg-sub">A raise is shared with you only if it passes all three.</text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Rate and risk fit: from more secure paper to higher-yield paper.    */
/* ------------------------------------------------------------------ */
export function RiskSpectrum() {
  const dots = [44, 82, 120, 150, 196, 228, 262, 300, 336, 380, 420, 462];
  const band = { from: 180, to: 350 };
  return (
    <Frame
      viewBox="0 0 520 200"
      title="Raises from more secure to higher-yield paper"
      desc="Raises sit along a line from more secure paper on the left to higher-yield paper on the right. A lender's band covers part of that line, and only raises inside the band reach it."
    >
      <line x1="30" x2="490" y1="100" y2="100" className="dg-line" markerEnd="url(#arrow-ink)" markerStart="url(#arrow-ink)" />
      <rect x={band.from} y="62" width={band.to - band.from} height="76" rx="4" className="dg-band" />
      <text x={(band.from + band.to) / 2} y="52" textAnchor="middle" className="dg-label">Your band</text>
      {dots.map((x) => (
        <circle key={x} cx={x} cy="100" r="8" className={x >= band.from && x <= band.to ? "dg-dot-brass" : "dg-dot"} />
      ))}
      <text x="30" y="166" className="dg-label">More secure paper</text>
      <text x="490" y="166" textAnchor="end" className="dg-label">Higher-yield paper</text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Two-level diligence.                                                */
/* ------------------------------------------------------------------ */
export function TwoLevelDiagram() {
  return (
    <Frame
      viewBox="0 0 520 300"
      title="Two-level diligence"
      desc="Level 1 is the platform's screening of the borrower, done before a raise is shared. Level 2 is each matched lender's own diligence on the borrower, run on the same files and recorded on the platform."
    >
      <g className="dg-layer dg-layer-1">
        <rect x="20" y="20" width="480" height="104" rx="6" />
        <text x="44" y="56" className="dg-h">Level 1: platform screening</text>
        <text x="44" y="82" className="dg-sub on-ink">Our team collects and reviews the company diligence online.</text>
        <text x="44" y="102" className="dg-sub on-ink">A raise is shared with lenders only after this.</text>
      </g>
      {[110, 260, 410].map((x) => (
        <path key={x} d={`M${x} 124 V170`} className="dg-flow" markerEnd="url(#arrow-brass)" />
      ))}
      <g className="dg-layer dg-layer-2">
        <rect x="20" y="172" width="480" height="108" rx="6" />
        <text x="44" y="206" className="dg-h">Level 2: each lender&apos;s own diligence</text>
      </g>
      {["Lender A", "Lender B", "Lender C"].map((l, i) => (
        <Box key={l} x={44 + i * 150} y={222} w={132} h={40} label={l} sub="on the same files" />
      ))}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* The full flow, proposal to sell-down.                               */
/* ------------------------------------------------------------------ */
export function FullFlow() {
  const cx = 220;
  return (
    <Frame
      viewBox="0 0 580 640"
      title="How a company's requirement moves from first call to disbursement"
      desc="A company's requirement is turned into a credit pack by the desk, matched to lenders on sector, size and security, and shared only with those that fit. Each runs its own credit review; term sheets are compared, then the chosen facility is sanctioned, documented and disbursed. The next tranche starts from the same file."
      className="dg-tall"
    >
      <Box x={cx - 110} y={20} w={220} h={56} label="Your requirement" sub="amount, purpose, security" tone="ink" />
      <path d={`M${cx} 76 V112`} className="dg-flow" markerEnd="url(#arrow-brass)" />
      <Box x={cx - 110} y={114} w={220} h={56} label="Credit pack" sub="the desk prepares and structures" />
      <path d={`M${cx} 170 V206`} className="dg-flow" markerEnd="url(#arrow-brass)" />
      <Box x={cx - 110} y={208} w={220} h={56} label="Lender match" sub="sector, size, security" />
      {[0, 1, 2].map((i) => {
        const lx = 20 + i * 140;
        return (
          <g key={i}>
            <path d={`M${cx} 264 C ${cx} 300, ${lx + 60} 290, ${lx + 60} 322`} className="dg-flow" markerEnd="url(#arrow-brass)" />
            <Box x={lx} y={324} w={120} h={56} label={["Bank", "NBFC", "Credit fund"][i]} sub="its own credit review" />
            <path d={`M${lx + 60} 380 C ${lx + 60} 412, ${cx} 404, ${cx} 438`} className="dg-flow" markerEnd="url(#arrow-brass)" />
          </g>
        );
      })}
      <path d={`M${cx + 110} 236 C 440 236, 470 280, 470 322`} className="dg-unshared" />
      <Box x={430} y={324} w={84} h={56} label="Lender" sub="not a fit" tone="muted" />
      <Box x={cx - 110} y={440} w={220} h={56} label="Term sheets compared" sub="rate, tenor, covenants" />
      <path d={`M${cx} 496 V532`} className="dg-flow" markerEnd="url(#arrow-brass)" />
      <Box x={cx - 110} y={534} w={220} h={56} label="Sanction and disbursement" sub="documents, then drawdown" tone="ink" />
      <path d={`M${cx + 110} 562 H 530 Q 556 562 556 536 V 74 Q 556 48 530 48 H ${cx + 114}`} className="dg-loop" markerEnd="url(#arrow-ink)" />
      <text x="544" y="470" className="dg-sub" transform="rotate(-90 544 470)">Next tranche, same file</text>
    </Frame>
  );
}
