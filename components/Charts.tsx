import type { RoomContent, Status } from "@/lib/types";

const num = (s: string) => { const n = parseFloat(String(s).replace(/[,~≈₹\s]/g, "")); return isFinite(n) ? n : null; };
function wrap(t: string, n = 16) {
  const out: string[] = []; let cur = "";
  for (const w of t.split(/\s+/)) { if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur); return out.slice(0, 3);
}

export function Donut({ h }: { h: NonNullable<RoomContent["highlight"]> }) {
  const C = 2 * Math.PI * 44, tot = h.a.value + h.b.value || 1, a = (h.a.value / tot) * C;
  return (
    <svg className="viz" viewBox="0 0 120 120" width="150" height="150" style={{ width: 150, height: 150, flex: "none" }}>
      <circle className="track" cx="60" cy="60" r="44" fill="none" strokeWidth="14" />
      <circle className="arc c1" cx="60" cy="60" r="44" fill="none" strokeWidth="14" strokeDasharray={`${a} ${C - a}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
      <circle className="arc cl" cx="60" cy="60" r="44" fill="none" strokeWidth="14" strokeDasharray={`${C - a} ${a}`} strokeDashoffset={-a} transform="rotate(-90 60 60)" />
      <text className="tv big" x="60" y="58" textAnchor="middle">{h.center}</text>
      <text className="tk" x="60" y="74" textAnchor="middle">{h.centerNote}</text>
    </svg>
  );
}

export function Ring({ done, total, size = 92 }: { done: number; total: number; size?: number }) {
  const C = 2 * Math.PI * 40, a = total ? (done / total) * C : 0;
  return (
    <svg className="viz ring" viewBox="0 0 100 100" width={size} height={size} style={{ width: size, height: size, flex: "none" }} role="img" aria-label={`${done} checks done`}>
      <circle className="track" cx="50" cy="50" r="40" fill="none" strokeWidth="9" />
      <circle className="arc c2" cx="50" cy="50" r="40" fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${a} ${C - a}`} transform="rotate(-90 50 50)" />
      <text className="tv big" x="50" y="52" textAnchor="middle">{done}</text>
      <text className="tk" x="50" y="68" textAnchor="middle" style={{ fontSize: "8.5px" }}>done</text>
    </svg>
  );
}

export function StatusBar({ done, prog, pend }: { done: number; prog: number; pend: number }) {
  const t = done + prog + pend || 1;
  return (
    <div className="statusbar" role="img" aria-label={`${done} done, ${prog} in progress, ${pend} pending`}>
      <div className="track"><i className="c2" style={{ width: `${(done / t) * 100}%` }} /><i className="c3" style={{ width: `${(prog / t) * 100}%` }} /></div>
      <ul className="legend"><li><i className="c2" /><span>Done</span><b>{done}</b></li><li><i className="c3" /><span>In progress</span><b>{prog}</b></li><li><i className="cl" /><span>Pending</span><b>{pend}</b></li></ul>
    </div>
  );
}

/** Grouped bars of the money rows in the financials table (revenue and profit lines, not ratios). */
export function Bars({ fin }: { fin: NonNullable<RoomContent["fin"]> }) {
  const money = fin.rows.filter((r) => !/%|growth|margin/i.test(r.label) && r.vals.some((v) => num(v) != null));
  // with many years, show revenue and the first profit line only, so labels stay readable
  const series = fin.cols.length > 3
    ? [money.find((r) => /revenue|sales/i.test(r.label)), money.find((r) => /pat|profit/i.test(r.label))].filter((r): r is typeof money[number] => !!r)
    : money.slice(0, 3);
  if (!series.length) return null;
  const cls = ["c1", "c2", "cm"];
  const cols = fin.cols, W = 520, L = 16, R = 504, base = 186, top = 52;
  const max = Math.max(...series.flatMap((s) => s.vals.map((v) => num(v) ?? 0))) || 1;
  const gw = (R - L) / cols.length, bw = Math.min(36, (gw - 16) / series.length);
  let k = 0;
  return (
    <svg className="viz bars" viewBox={`0 0 ${W} 230`} role="img" aria-label={`${series.map((s) => s.label).join(" and ")} by year`}>
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="grid" x1={L} x2={R} y1={base - (base - top) * f} y2={base - (base - top) * f} />)}
      <line className="axis" x1={L} x2={R} y1={base} y2={base} />
      {cols.map((c, ci) => {
        const cx = L + gw * ci + gw / 2, x0 = cx - (bw * series.length + 6 * (series.length - 1)) / 2;
        return (
          <g key={c}>
            {series.map((s, si) => {
              const v = num(s.vals[ci] ?? ""), x = x0 + si * (bw + 6);
              if (v == null) return <text key={si} className="tk" x={x + bw / 2} y={base - 8} textAnchor="middle">—</text>;
              const h = Math.max(2, ((base - top) * v) / max);
              return (
                <g key={si} className="bargrp"><title>{`${s.label} ${c}: ₹${s.vals[ci]} Cr`}</title>
                  <rect className={`bar ${cls[si]}`} x={x} y={base - h} width={bw} height={h} rx="3" style={{ ["--i" as string]: k++ }} />
                  <text className="tv" x={x + bw / 2} y={base - h - 7} textAnchor="middle">{s.vals[ci]}</text>
                </g>
              );
            })}
            <text className="tk" x={cx} y={204} textAnchor="middle">{c}</text>
          </g>
        );
      })}
      {series.map((s, si) => (
        <g key={s.label}><rect className={`lg ${cls[si]}`} style={{ fill: "var(--" + (cls[si] === "c1" ? "accent" : cls[si] === "c2" ? "live" : "ink3") + ")" }} x={L + si * 170} y={8} width="10" height="10" rx="2" /><text className="tk" x={L + si * 170 + 16} y={17}>{s.label}</text></g>
      ))}
    </svg>
  );
}

export function HBars({ items }: { items: NonNullable<RoomContent["pe"]> }) {
  const max = Math.max(40, ...items.map((i) => Math.min(i.value, 80)));
  return (
    <svg className="viz hbars" viewBox={`0 0 420 ${items.length * 50 + 6}`} role="img" aria-label="Implied price to earnings">
      {items.map((it, i) => {
        const y = 14 + i * 50, w = Math.min(214, (214 * Math.min(it.value, max)) / max);
        return (
          <g key={i}>
            <text className="tl" x="0" y={y + 10}>{it.label}</text><text className="tk" x="0" y={y + 26}>{it.sub}</text>
            <rect className="track" x="150" y={y} width="214" height="16" rx="8" />
            <rect className="bar c1" x="150" y={y} width={w} height="16" rx="8" style={{ ["--i" as string]: i }} />
            <text className="tv" x={Math.min(150 + w + 8, 372)} y={y + 13}>{it.value >= 100 ? Math.round(it.value) : it.value}x</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Timeline({ path }: { path: { status: Status; title: string; note: string }[] }) {
  const n = path.length; if (!n) return null;
  const x0 = 70, x1 = 870, step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  const lastDone = path.map((p) => p.status).lastIndexOf("done"), lastProg = path.map((p) => p.status).lastIndexOf("in-progress");
  return (
    <svg className="viz timeline" viewBox="0 0 940 150" role="img" aria-label="IPO path milestones">
      <line className="axis" x1={x0} x2={x1} y1="48" y2="48" />
      {lastDone > 0 && <line className="c2s" x1={x0} x2={x0 + step * lastDone} y1="48" y2="48" strokeWidth="4" />}
      {lastProg > Math.max(0, lastDone) && <line className="c3s dashed" x1={x0 + step * Math.max(0, lastDone)} x2={x0 + step * lastProg} y1="48" y2="48" strokeWidth="3" />}
      {path.map((p, i) => {
        const x = x0 + step * i;
        return (
          <g key={i} className={`node ${p.status}`}>
            <circle cx={x} cy="48" r="11" className="halo" /><circle cx={x} cy="48" r="7" className="dot" />
            {p.status === "done" && <path className="tick" d={`M${x - 3.5} 48 l2.5 2.5 l4.5 -5`} fill="none" />}
            {wrap(p.title).map((l, j) => <text key={j} className="tl" x={x} y={80 + j * 14} textAnchor="middle">{l}</text>)}
            <text className="tk" x={x} y="26" textAnchor="middle">{p.note}</text>
          </g>
        );
      })}
    </svg>
  );
}
