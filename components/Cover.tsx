// Article cover art: an uploaded image when there is one, otherwise a bold, colourful
// illustration picked from the article's subject, so every article carries a picture.
import { coverTheme, hash, type Motif } from "@/lib/cover-theme";

type A = { slug: string; title: string; image?: string | null };

const W = "#ffffff";

function Art({ m, accent, h }: { m: Motif; accent: string; h: number }) {
  const r = (i: number) => ((h >>> (i % 24)) % 97) / 97;
  switch (m) {
    case "bell":
      return <g transform="translate(560 205)">
        {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <line key={i} x1={Math.cos(a) * 150} y1={Math.sin(a) * 150} x2={Math.cos(a) * 190} y2={Math.sin(a) * 190} stroke={accent} strokeWidth="10" strokeLinecap="round" opacity=".9" />; })}
        <path d="M-95 70 C -95 -10 -70 -95 0 -105 C 70 -95 95 -10 95 70 L 120 95 H -120 Z" fill={W} />
        <path d="M-60 60 C -60 0 -45 -60 0 -72" stroke={accent} strokeWidth="12" fill="none" strokeLinecap="round" opacity=".8" />
        <circle cx="0" cy="118" r="24" fill={accent} /><rect x="-14" y="-132" width="28" height="30" rx="10" fill={W} />
      </g>;
    case "ship":
      return <g transform="translate(560 230)">
        {[90, 140, 190].map((rr, i) => <path key={i} d={`M ${-rr * .7} ${-110 - rr * .35} A ${rr} ${rr} 0 0 1 ${rr * .7} ${-110 - rr * .35}`} stroke={accent} strokeWidth="9" fill="none" strokeLinecap="round" opacity={0.9 - i * .25} />)}
        <path d="M-200 30 H 200 L 160 100 H -165 Z" fill={W} />
        <rect x="-110" y="-20" width="150" height="50" rx="6" fill={W} opacity=".92" /><rect x="-60" y="-70" width="70" height="50" rx="6" fill={W} opacity=".85" />
        <line x1="-25" y1="-70" x2="-25" y2="-120" stroke={W} strokeWidth="8" /><circle cx="-25" cy="-128" r="11" fill={accent} />
        <path d="M-230 132 q 30 -18 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0" stroke={W} strokeWidth="7" fill="none" opacity=".7" />
      </g>;
    case "percent":
      return <g transform="translate(575 215)">
        <circle cx="0" cy="0" r="165" fill={W} opacity=".14" />
        <text x="0" y="78" textAnchor="middle" fontSize="250" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">%</text>
        <path d="M 95 -95 L 175 -175 M 120 -175 H 175 V -120" stroke={accent} strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>;
    case "drop":
      return <g transform="translate(560 215)">
        <path d="M0 -150 C 60 -70 115 -10 115 55 C 115 120 62 160 0 160 C -62 160 -115 120 -115 55 C -115 -10 -60 -70 0 -150 Z" fill={W} />
        <path d="M -48 70 C -48 105 -25 125 5 128" stroke={accent} strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d="M 95 -40 C 190 -95 235 -30 220 30 C 160 40 100 10 95 -40 Z" fill={accent} /><path d="M 105 -30 L 205 20" stroke="#065f46" strokeWidth="5" opacity=".5" />
      </g>;
    case "globe":
      return <g transform="translate(560 210)">
        <circle r="135" fill={W} opacity=".95" />
        <ellipse rx="60" ry="135" fill="none" stroke="#6366f1" strokeWidth="6" opacity=".55" /><line x1="-135" y1="0" x2="135" y2="0" stroke="#6366f1" strokeWidth="6" opacity=".55" />
        <path d="M -120 -55 H 120 M -120 55 H 120" stroke="#6366f1" strokeWidth="5" opacity=".35" />
        <path d="M 150 -120 C 230 -60 230 60 160 120" stroke={accent} strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d="M 140 100 L 165 125 L 190 95" stroke={accent} strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="-205" y="-95" fontSize="64" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">₹</text>
      </g>;
    case "shield":
      return <g transform="translate(560 210)">
        <path d="M0 -160 L 135 -110 V 10 C 135 95 75 145 0 175 C -75 145 -135 95 -135 10 V -110 Z" fill={W} />
        <path d="M -55 10 L -12 52 L 70 -40" stroke={accent} strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {[0, 1, 2].map((i) => <rect key={i} x={170} y={-90 + i * 55} width={70 - i * 12} height="16" rx="8" fill={W} opacity=".6" />)}
      </g>;
    case "tower":
      return <g transform="translate(560 230)">
        {[70, 120, 170].map((rr, i) => <g key={i} opacity={1 - i * .25}><path d={`M ${-rr} ${-120} A ${rr} ${rr} 0 0 1 ${-rr * .35} ${-120 - rr * .93}`} stroke={accent} strokeWidth="11" fill="none" strokeLinecap="round" /><path d={`M ${rr} ${-120} A ${rr} ${rr} 0 0 0 ${rr * .35} ${-120 - rr * .93}`} stroke={accent} strokeWidth="11" fill="none" strokeLinecap="round" /></g>)}
        <path d="M0 -120 L 70 140 H -70 Z" fill="none" stroke={W} strokeWidth="14" strokeLinejoin="round" />
        <path d="M -40 30 L 40 30 M -55 85 L 55 85 M -22 -30 L 22 -30" stroke={W} strokeWidth="10" />
        <circle cy="-120" r="22" fill={W} />
      </g>;
    default:
      return <g transform="translate(400 330)">
        {Array.from({ length: 7 }, (_, i) => { const v = 70 + i * 32 + r(i) * 30; return <rect key={i} x={i * 56} y={-v} width="38" height={v} rx="8" fill={i === 6 ? accent : W} opacity={i === 6 ? 1 : .55 + i * .06} />; })}
        <path d="M -10 -110 L 90 -170 L 170 -140 L 300 -280" stroke={W} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 250 -285 H 305 V -230" stroke={W} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>;
  }
}

export function Cover({ a, className = "" }: { a: A; className?: string }) {
  if (a.image) return <div className={`cover ${className}`}><img src={a.image} alt="" loading="lazy" /></div>;
  const th = coverTheme(a), h = hash(a.slug), id = `c${h}`;
  const dots = [];
  for (let y = 300; y < 410; y += 22) for (let x = 30; x < 250; x += 22) dots.push(<circle key={x + "-" + y} cx={x} cy={y} r="3.2" fill={W} opacity=".28" />);
  return (
    <div className={`cover ${className}`} aria-hidden="true">
      <svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={th.from} /><stop offset="1" stopColor={th.to} /></linearGradient>
          <filter id={id + "b"}><feGaussianBlur stdDeviation="40" /></filter>
        </defs>
        <rect width="800" height="420" fill={`url(#${id})`} />
        <circle cx={120 + (h % 120)} cy="40" r="170" fill={th.accent} opacity=".35" filter={`url(#${id}b)`} />
        <circle cx="760" cy="420" r="200" fill="#000" opacity=".22" filter={`url(#${id}b)`} />
        <g opacity=".12">{Array.from({ length: 9 }, (_, i) => <line key={i} x1={-40 + i * 34} y1="0" x2={-200 + i * 34} y2="160" stroke={W} strokeWidth="10" />)}</g>
        {dots}
        <Art m={th.motif} accent={th.accent} h={h} />
        <g transform="translate(36 40)">
          <rect width={th.label.length * 14.5 + 52} height="44" rx="22" fill={W} />
          <circle cx="22" cy="22" r="7" fill={th.to} />
          <text x="38" y="29" fontSize="19" fontWeight="800" letterSpacing="1.5" fill="#0b1730" fontFamily="Arial, sans-serif">{th.label.toUpperCase()}</text>
        </g>
      </svg>
    </div>
  );
}
