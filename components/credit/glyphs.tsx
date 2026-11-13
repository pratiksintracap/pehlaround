/* Small line glyphs for the capability list. Decorative: the text beside each one carries the meaning. */

const common = {
  className: "glyph",
  viewBox: "0 0 44 44",
  "aria-hidden": true,
  focusable: false,
  fill: "none",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GlyphDiligence() {
  return (
    <svg {...common}>
      <rect x="6" y="5" width="22" height="30" rx="2" stroke="var(--pc-ink)" />
      <rect x="14" y="10" width="22" height="30" rx="2" stroke="var(--pc-ink)" fill="var(--pc-surface)" />
      <path d="M19 20h12M19 25h12M19 30h7" stroke="var(--pc-rule2)" />
      <path d="M30 34l3 3 6-7" stroke="var(--pc-accent)" />
    </svg>
  );
}

export function GlyphMatch() {
  return (
    <svg {...common}>
      <path d="M5 9h34l-12 14v12l-10 4V23z" stroke="var(--pc-ink)" />
      <path d="M17 23h10" stroke="var(--pc-accent)" />
    </svg>
  );
}

export function GlyphSellDown() {
  return (
    <svg {...common}>
      <rect x="4" y="14" width="36" height="16" rx="1.5" stroke="var(--pc-ink)" />
      <path d="M16 14v16M26 14v16M33 14v16" stroke="var(--pc-ink)" />
      <path d="M4 36h29" stroke="var(--pc-accent)" />
    </svg>
  );
}

export function GlyphCycles() {
  return (
    <svg {...common}>
      <path d="M36 16a15 15 0 1 0 1.5 10" stroke="var(--pc-ink)" />
      <path d="M37 8v8h-8" stroke="var(--pc-ink)" />
      <circle cx="22" cy="22" r="3" fill="var(--pc-accent-l)" stroke="var(--pc-accent)" />
    </svg>
  );
}

export function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="9" fill="var(--pc-ink)" />
      <path d="M5 9.3l2.6 2.6L13 6.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Cross() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="8.25" fill="none" stroke="var(--pc-rule2)" strokeWidth="1.5" />
      <path d="M6.2 6.2l5.6 5.6M11.8 6.2l-5.6 5.6" stroke="var(--pc-muted)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
