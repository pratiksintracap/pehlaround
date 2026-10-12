// Article cover art: an uploaded image when there is one, otherwise a generated illustration
// picked from the article's subject, so every article carries a picture.

type A = { slug: string; title: string; image?: string | null };

function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

function motif(a: A) {
  const t = (a.title + " " + a.slug).toLowerCase();
  if (/sebi|regulat|platform|rule|law|advisory/.test(t)) return "shield";
  if (/foreign|fii|fpi|rupee|outflow|selling/.test(t)) return "flow";
  if (/ipo|listing|calendar|issue/.test(t)) return hash(a.slug) % 2 ? "bars" : "calendar";
  return ["candles", "bars", "flow", "calendar"][hash(a.slug) % 4];
}

export function Cover({ a, className = "" }: { a: A; className?: string }) {
  if (a.image) return <div className={`cover ${className}`}><img src={a.image} alt="" loading="lazy" /></div>;
  const m = motif(a), h = hash(a.slug);
  const rnd = (i: number) => ((h >>> (i % 24)) % 97) / 97;
  const grid = [];
  for (let x = 40; x < 800; x += 40) grid.push(<line key={"x" + x} x1={x} y1="0" x2={x} y2="420" />);
  for (let y = 40; y < 420; y += 40) grid.push(<line key={"y" + y} x1="0" y1={y} x2="800" y2={y} />);
  let art: React.ReactNode = null;
  if (m === "bars") {
    art = <g>{Array.from({ length: 9 }, (_, i) => { const v = 60 + i * 26 + rnd(i) * 40; return <rect key={i} x={110 + i * 64} y={340 - v} width="40" height={v} rx="5" className={i === 8 ? "c-acc" : "c-soft"} />; })}
      <path d="M 640 70 V 30 M 640 30 h 46 l -12 12 12 12 h -46" className="c-line live" fill="none" /></g>;
  } else if (m === "flow") {
    const pts = Array.from({ length: 12 }, (_, i) => `${80 + i * 58},${110 + i * 16 + (rnd(i) - .5) * 50}`).join(" ");
    art = <g><polyline points={pts} className="c-line acc" fill="none" />
      <polygon points={`80,340 ${pts} 718,340`} className="c-fill" />
      <path d="M 690 300 l 40 40 M 730 300 v 40 h -40" className="c-line amber" fill="none" />
      <circle cx="160" cy="110" r="44" className="c-ring" /><text x="160" y="124" textAnchor="middle" className="c-glyph">₹</text></g>;
  } else if (m === "shield") {
    art = <g><path d="M400 60 L 520 104 V 210 C 520 290 466 334 400 360 C 334 334 280 290 280 210 V 104 Z" className="c-shield" />
      <path d="M352 210 l 34 34 l 66 -76" className="c-line live" fill="none" />
      {[0, 1, 2].map((i) => <rect key={i} x={590} y={110 + i * 70} width={150 - i * 30} height="14" rx="7" className="c-soft" />)}
      {[0, 1, 2].map((i) => <rect key={"l" + i} x={60 + i * 30} y={110 + i * 70} width={150 - i * 30} height="14" rx="7" className="c-soft" />)}</g>;
  } else if (m === "calendar") {
    art = <g>{Array.from({ length: 4 }, (_, r) => Array.from({ length: 7 }, (_, c) => {
      const on = (r * 7 + c + h) % 5 === 0;
      return <rect key={r + "-" + c} x={150 + c * 72} y={90 + r * 64} width="58" height="50" rx="8" className={on ? "c-acc" : "c-soft"} />;
    }))}</g>;
  } else {
    art = <g>{Array.from({ length: 11 }, (_, i) => { const o = 140 + rnd(i) * 140, c = o + (rnd(i + 3) - .5) * 90, up = c < o;
      return <g key={i}><line x1={110 + i * 58} x2={110 + i * 58} y1={Math.min(o, c) - 30} y2={Math.max(o, c) + 30} className="c-wick" />
        <rect x={96 + i * 58} y={Math.min(o, c)} width="28" height={Math.max(8, Math.abs(c - o))} rx="3" className={up ? "c-live" : "c-acc"} /></g>; })}</g>;
  }
  return (
    <div className={`cover ${className}`} aria-hidden="true">
      <svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
        <defs><radialGradient id={`g${h}`} cx="20%" cy="0%" r="90%"><stop offset="0" stopColor="#1b2d5c" /><stop offset="1" stopColor="#070d19" /></radialGradient></defs>
        <rect width="800" height="420" fill={`url(#g${h})`} />
        <g className="c-grid">{grid}</g>
        {art}
      </svg>
    </div>
  );
}
