import type { PeerCompare as PC } from "@/lib/types";

// The "Peers" tab of a deal room: where the company stands against listed peers, from the summary down to
// every figure. Server-rendered SVG, no client code. companies[0] is the company in the room.

type Metric = PC["metrics"][number];

const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const peerVals = (m: Metric) => m.vals.slice(1).filter((v): v is number => typeof v === "number");
const peerMed = (m: Metric) => med(peerVals(m));

export function fmtV(v: number | null | undefined, unit: string) {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  const n = Number.isInteger(v) ? v.toLocaleString("en-IN") : a >= 1000 ? Math.round(v).toLocaleString("en-IN") : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(a < 1 && a > 0 ? 2 : 1);
  if (unit === "₹ Cr") return `₹${n} Cr`;
  if (unit === "%") return `${n}%`;
  if (unit === "x") return `${n}x`;
  if (unit === "days") return `${n} d`;
  return n;
}

const isVal = (m: Metric) => /valuation/i.test(m.group);
const isMultiple = (m: Metric) => isVal(m) && m.unit === "x";

/** Where the company sits on one metric: "ahead" of the peer median, "behind" it, or "par"/"na". */
function standing(m: Metric): "ahead" | "behind" | "par" | "na" {
  const v = m.vals[0], md = peerMed(m);
  if (m.better === "none" || v == null || md == null) return "na";
  const d = (v - md) / (Math.abs(md) || 1);
  if (Math.abs(d) < 0.05) return "par";
  return (m.better === "high" ? d > 0 : d < 0) ? "ahead" : "behind";
}

/** Rank 1 = best among the companies with a value. */
function rank(m: Metric, i: number) {
  const v = m.vals[i];
  if (m.better === "none" || v == null) return null;
  const xs = m.vals.filter((x): x is number => x != null);
  const better = xs.filter((x) => (m.better === "high" ? x > v : x < v)).length;
  return { r: better + 1, of: xs.length };
}

const EDGE: Record<string, [string, string]> = { ahead: ["ok", "Ahead"], par: ["mid", "On par"], behind: ["off", "Behind"], mixed: ["mid", "Mixed"], na: ["off", "—"] };

export function PeerCompare({ c }: { c: PC }) {
  const subj = c.companies[0];
  const ranked = c.metrics.filter((m) => !isVal(m) && standing(m) !== "na");
  const ahead = ranked.filter((m) => standing(m) === "ahead").length;
  const groups = [...new Set(c.metrics.map((m) => m.group))];
  return (
    <div className="pc">
      <div className="pc-head">
        <div><span className="eyebrow">Peer comparison</span>
          <h3>How {subj.short} stands against {c.companies.length - 1} listed peers</h3>
          <p className="fine">{c.basis} {c.asOf}.</p></div>
        <div className="pc-score" role="img" aria-label={`Ahead of the peer median on ${ahead} of ${ranked.length} measured figures`}>
          <b>{ahead}<small>/{ranked.length}</small></b><span>operating figures ahead of the listed-peer median</span>
        </div>
      </div>

      <div className="pc-stands">
        <div className="pc-card pc-ok"><span className="k">Where it is ahead</span><ul>{c.stands.ahead.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
        <div className="pc-card pc-off"><span className="k">Where it is behind</span><ul>{c.stands.behind.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
        <div className="pc-card pc-mid"><span className="k">What would move it</span><ul>{c.stands.watch.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      </div>
      {!!c.stands.valuation?.length && <div className="pc-card pc-val"><span className="k">Valuation at the round, for reference</span><ul>{c.stands.valuation.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <p className="fine">Facts on the multiple only. The desk does not publish a view on whether the price is fair; a listed share is liquid where this one is not.</p></div>}

      <div className="pc-groups">{groups.map((g) => {
        const ms = c.metrics.filter((m) => m.group === g), st = ms.map(standing).filter((s) => s !== "na");
        const a = st.filter((s) => s === "ahead").length;
        if (ms.some(isVal)) { const mm = ms.filter(isMultiple), below = mm.filter((m) => m.vals[0] != null && peerMed(m) != null && m.vals[0]! < peerMed(m)!).length, nn = mm.filter((m) => m.vals[0] != null && peerMed(m) != null).length;
          return <div key={g} className="pc-g pc-na"><span className="k">{g}</span><b>{nn ? `${below} of ${nn}` : "—"}</b><small>{nn ? "multiples below the peer median" : "for reference"}</small></div>; }
        const tone = !st.length ? "pc-na" : a / st.length >= 0.6 ? "pc-ok" : a / st.length <= 0.34 ? "pc-off" : "pc-mid";
        return <div key={g} className={`pc-g ${tone}`}><span className="k">{g}</span><b>{st.length ? `${a} of ${st.length}` : "—"}</b><small>{st.length ? "ahead of median" : "for reference"}</small></div>;
      })}</div>

      <div className="charts pc-charts">
        {c.scatter && <Scatter c={c} />}
        {c.dims.length >= 3 && <Radar c={c} />}
      </div>

      <h4 className="pc-h">Figure by figure</h4>
      <p className="fine">Each bar is a company; <i className="pc-sw s" /> is {subj.short}, <i className="pc-sw p" /> its listed peers, and the dashed line the peer median. Rank is among the companies with a figure.</p>
      <div className="pc-bars">{c.metrics.map((m, i) => <MetricBars key={i} m={m} c={c} />)}</div>

      <h4 className="pc-h">The full table</h4>
      <div className="pc-scroll"><table className="pc-heat">
        <thead><tr><th>Figure</th>{c.companies.map((co, i) => <th key={i} className={i === 0 ? "s" : ""}>{co.short}</th>)}<th>Peer median</th></tr></thead>
        <tbody>{groups.map((g) => [
          <tr key={`g-${g}`} className="grp"><td colSpan={c.companies.length + 2}>{g}</td></tr>,
          ...c.metrics.filter((m) => m.group === g).map((m, j) => (
            <tr key={`${g}-${j}`}><td>{m.label}{m.note && <small>{m.note}</small>}</td>
              {m.vals.map((v, i) => { const r = isVal(m) ? null : rank(m, i); const t = r && r.of > 1 ? (r.r - 1) / (r.of - 1) : null;
                return <td key={i} className={`${i === 0 ? "s " : ""}${t == null ? "" : t <= 0.2 ? "h4" : t <= 0.45 ? "h3" : t <= 0.7 ? "h2" : "h1"}`}>{fmtV(v, m.unit)}</td>; })}
              <td className="md">{fmtV(peerMed(m), m.unit)}</td></tr>)),
        ])}</tbody></table></div>
      <p className="fine"><span className="pc-key h4" /> best in the set <span className="pc-key h1" /> weakest in the set. Operating figures are shaded by rank; valuation multiples are left unshaded, as the desk does not publish a view on whether a price is fair.</p>

      <h4 className="pc-h">Product, customers and position</h4>
      <div className="pc-scroll"><table className="pc-matrix">
        <thead><tr><th>Aspect</th>{c.companies.map((co, i) => <th key={i} className={i === 0 ? "s" : ""}>{co.short}</th>)}</tr></thead>
        <tbody>{c.matrix.map((r, i) => (
          <tr key={i}><td><b>{r.aspect}</b><span className={`pill ${EDGE[r.edge]?.[0] ?? "mid"}`}>{EDGE[r.edge]?.[1] ?? r.edge}</span><small>{r.why}</small></td>
            {r.cells.map((x, j) => <td key={j} className={j === 0 ? "s" : ""}>{x}</td>)}</tr>))}</tbody>
      </table></div>

      <h4 className="pc-h">Qualitative scores</h4>
      <div className="pc-scroll"><table className="pc-dims">
        <thead><tr><th>Dimension</th>{c.companies.map((co, i) => <th key={i} className={i === 0 ? "s" : ""}>{co.short}</th>)}</tr></thead>
        <tbody>{c.dims.map((d, i) => (
          <tr key={i}><td><b>{d.name}</b><small>{d.why}</small></td>
            {d.scores.map((s, j) => <td key={j} className={j === 0 ? "s" : ""}><Dots n={s} /></td>)}</tr>))}</tbody>
      </table></div>
      <p className="fine">Scored 1 to 5 by the desk, relative to this set of companies, from public filings and the material in this room.</p>

      <h4 className="pc-h">Entry barriers: what protects {subj.short}</h4>
      <ul className="pc-barriers">{c.barriers.map((b, i) => (
        <li key={i}><div className="lvl" role="img" aria-label={`${["Weak", "Moderate", "Strong"][Math.min(3, Math.max(1, b.level)) - 1]} protection`}>{[1, 2, 3].map((k) => <i key={k} className={k <= b.level ? "on" : ""} />)}</div>
          <div><b>{b.name}</b> <span className="fine">{["Weak", "Moderate", "Strong"][Math.min(3, Math.max(1, b.level)) - 1]}</span><p>{b.note}</p></div></li>))}</ul>

      <h4 className="pc-h">The peers</h4>
      <ul className="pc-peers">{c.companies.map((co, i) => (
        <li key={i} className={i === 0 ? "s" : ""}><b>{co.name}</b>{co.ticker && <span className="mono">{co.ticker}</span>}{co.mcapCr ? <span className="fine">{i === 0 ? "Valuation at the round" : "Market cap"} {fmtV(co.mcapCr, "₹ Cr")}</span> : null}{co.note && <small>{co.note}</small>}</li>))}</ul>

      <details className="pc-src"><summary>Sources ({c.sources.length})</summary><ul>{c.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}</li>)}</ul></details>
      <p className="note">Listed-peer figures are from public filings and exchange data; the company&apos;s figures are those in this room, at the round&apos;s price. Peers differ in size, stage and accounting, and a listed share is liquid where this one is not. This comparison is information for your office&apos;s own assessment, not a recommendation or a view that the price is fair.</p>
    </div>
  );
}

function Dots({ n }: { n: number }) {
  const v = Math.max(0, Math.min(5, Math.round(n)));
  return <span className="pc-dots" role="img" aria-label={`${v} of 5`}>{[1, 2, 3, 4, 5].map((k) => <i key={k} className={k <= v ? "on" : ""} />)}</span>;
}

function MetricBars({ m, c }: { m: Metric; c: PC }) {
  const vals = m.vals.map((v) => (v == null ? null : v));
  const nums = vals.filter((v): v is number => v != null);
  if (!nums.length) return null;
  const lo = Math.min(0, ...nums), hi = Math.max(0, ...nums), span = hi - lo || 1;
  const W = 300, L = 92, R = 58, bw = W - L - R, rowH = 20, H = vals.length * rowH + 8;
  const x = (v: number) => L + ((v - lo) / span) * bw;
  const md = peerMed(m), val = isVal(m), st = val ? "na" : standing(m), rk = val ? null : rank(m, 0);
  const v0 = vals[0], valLbl = isMultiple(m) && v0 != null && md != null ? (Math.abs(v0 - md) / (Math.abs(md) || 1) < 0.05 ? "At the peer median" : v0 < md ? "Below the peer median" : "Above the peer median") : null;
  return (
    <div className={`pc-bar ${st}`}>
      <div className="pc-bar-h"><span className="k">{m.group}</span><b>{m.label}</b>
        <span className={`pill ${valLbl ? "mid" : EDGE[st][0]}`}>{valLbl ?? (st === "na" ? (v0 == null ? "Not disclosed" : m.better === "none" || val ? "For reference" : "No peer figure") : `${EDGE[st][1]}${rk ? ` · #${rk.r} of ${rk.of}` : ""}`)}</span></div>
      <svg className="viz" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${m.label}: ${c.companies.map((co, i) => `${co.short} ${fmtV(vals[i], m.unit)}`).join(", ")}`}>
        <line className="axis" x1={x(0)} x2={x(0)} y1={2} y2={H - 4} />
        {vals.map((v, i) => {
          const y = 4 + i * rowH;
          return <g key={i}>
            <text className={i === 0 ? "tl" : ""} x={L - 6} y={y + 12} textAnchor="end">{c.companies[i].short}</text>
            {v != null ? <rect className={i === 0 ? "c1" : "cm pc-peerbar"} x={Math.min(x(0), x(v))} y={y + 3} width={Math.max(1.5, Math.abs(x(v) - x(0)))} height={rowH - 8} rx={2} />
              : <text className="tk" x={x(0) + 4} y={y + 12}>n/a</text>}
            {v != null && <text className="tv" x={Math.max(x(0), x(v)) + 4} y={y + 12}>{fmtV(v, m.unit)}</text>}
          </g>;
        })}
        {md != null && <line className="axis dashed pc-med" x1={x(md)} x2={x(md)} y1={2} y2={H - 4} />}
      </svg>
      {m.note && <small className="fine">{m.note}</small>}
    </div>
  );
}

function Scatter({ c }: { c: PC }) {
  const mx = c.metrics.find((m) => m.label === c.scatter!.x), my = c.metrics.find((m) => m.label === c.scatter!.y);
  if (!mx || !my) return null;
  const pts = c.companies.map((co, i) => ({ co, i, x: mx.vals[i], y: my.vals[i] })).filter((p): p is { co: typeof p.co; i: number; x: number; y: number } => p.x != null && p.y != null);
  if (pts.length < 2) return null;
  const W = 420, H = 300, L = 48, B = 40, T = 14, Rt = 16;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const pad = (a: number, b: number) => { const d = (b - a) || Math.abs(a) || 1; return [a - d * 0.12, b + d * 0.12]; };
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs)), [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
  const sx = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - Rt), sy = (v: number) => H - B - ((v - y0) / (y1 - y0)) * (H - B - T);
  const mdx = peerMed(mx), mdy = peerMed(my);
  const ticks = (a: number, b: number) => [0, 0.25, 0.5, 0.75, 1].map((t) => a + (b - a) * t);
  return (
    <div className="chart pc-scatter"><span className="k">Positioning: {mx.label} against {my.label}</span>
      <svg className="viz" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Scatter of ${mx.label} against ${my.label}`}>
        {ticks(y0, y1).map((v, i) => <g key={`y${i}`}><line className="grid" x1={L} x2={W - Rt} y1={sy(v)} y2={sy(v)} /><text className="tk" x={L - 6} y={sy(v) + 4} textAnchor="end">{fmtV(v, my.unit)}</text></g>)}
        {ticks(x0, x1).map((v, i) => <text key={`x${i}`} className="tk" x={sx(v)} y={H - B + 16} textAnchor="middle">{fmtV(v, mx.unit)}</text>)}
        {mdx != null && <line className="axis dashed" x1={sx(mdx)} x2={sx(mdx)} y1={T} y2={H - B} />}
        {mdy != null && <line className="axis dashed" x1={L} x2={W - Rt} y1={sy(mdy)} y2={sy(mdy)} />}
        {pts.map((p) => <g key={p.i}>
          <circle className={p.i === 0 ? "c1 pc-dot s" : "cm pc-dot"} cx={sx(p.x)} cy={sy(p.y)} r={p.i === 0 ? 8 : 5.5} />
          <text className={p.i === 0 ? "tl" : ""} x={sx(p.x) + (sx(p.x) > W - 110 ? -10 : 10)} y={sy(p.y) + 4} textAnchor={sx(p.x) > W - 110 ? "end" : "start"}>{p.co.short}</text>
        </g>)}
        <text className="tk" x={(L + W - Rt) / 2} y={H - 6} textAnchor="middle">{mx.label} {mx.better === "high" ? "→ higher is better" : mx.better === "low" ? "→ lower is better" : ""}</text>
      </svg>
      <p className="fine">Dashed lines are the peer medians. {my.better === "low" ? `Lower on the vertical axis means a lower ${my.label}.` : ""}</p>
    </div>
  );
}

function Radar({ c }: { c: PC }) {
  const dims = c.dims, n = dims.length, W = 560, H = 320, cx = W / 2, cy = H / 2, R = 108;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [cx + Math.cos(ang(i)) * (R * v) / 5, cy + Math.sin(ang(i)) * (R * v) / 5];
  const poly = (vs: number[]) => vs.map((v, i) => pt(i, v).join(",")).join(" ");
  const subj = dims.map((d) => d.scores[0] ?? 0);
  const peers = dims.map((d) => { const xs = d.scores.slice(1).filter((x) => typeof x === "number"); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; });
  const best = dims.map((d) => Math.max(...d.scores.slice(1)));
  return (
    <div className="chart pc-radar"><span className="k">Qualitative profile against the peer average</span>
      <svg className="viz" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Radar: ${dims.map((d, i) => `${d.name} ${subj[i]} against peer average ${peers[i].toFixed(1)}`).join("; ")}`}>
        {[1, 2, 3, 4, 5].map((k) => <polygon key={k} className="pc-ring" points={poly(dims.map(() => k))} />)}
        {dims.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} className="grid" x1={cx} y1={cy} x2={x} y2={y} />; })}
        <polygon className="pc-best" points={poly(best)} />
        <polygon className="pc-peers" points={poly(peers)} />
        <polygon className="pc-subj" points={poly(subj)} />
        {subj.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} className="c1" cx={x} cy={y} r={3.2} />; })}
        {dims.map((d, i) => { const [x, y] = pt(i, 5.75); const a = Math.cos(ang(i));
          return <text key={i} className="tk pc-rl" x={x} y={y} textAnchor={a > 0.3 ? "start" : a < -0.3 ? "end" : "middle"}>{d.name.length > 28 ? d.name.slice(0, 27) + "…" : d.name}</text>; })}
      </svg>
      <ul className="legend"><li><i className="c1" /><span>{c.companies[0].short}</span></li><li><i className="cm" /><span>Peer average</span></li><li><i className="cl" /><span>Best peer on each</span></li></ul>
    </div>
  );
}
