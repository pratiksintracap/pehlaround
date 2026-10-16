/* The three layers of the investor journey, with where this visitor stands:
   1 register and get approved · 2 see every company by name, with its pitch deck · 3 sign that company's NDA, open its data bank. */
export function Journey({ at, slug, canSign, open }: { at: 0 | 1 | 2 | 3; slug: string; canSign: boolean; open: boolean }) {
  const steps = [
    { t: "Register and get approved", s: "Name, office or fund, how you invest. The desk approves each investor, usually within a few minutes.", done: at >= 2, now: at <= 1, cta: at === 0 ? { href: `/register?next=${encodeURIComponent(`/deals/${slug}#deck`)}`, label: "Register" } : at === 1 ? { href: "/dashboard", label: "Approval pending" } : null },
    { t: "See the company", s: "Every company opens by name: round, pre-money, Desk Score, pitch deck and general information.", done: at >= 3, now: at === 2, cta: null },
    { t: "Sign its NDA, open the data bank", s: "The desk's diligence file, the financials, the Q&A and the company's proprietary material, opened by its NDA, signed on screen.", done: false, now: at === 3, cta: at === 2 && canSign ? { href: "#sign", label: "Sign the NDA" } : at === 2 && !open ? { href: "#", label: "Room not open yet" } : at === 3 ? { href: `/room/${slug}#Documents`, label: "Open the data bank" } : null },
  ];
  return (
    <ol className="steps3 rv inview" aria-label="Your journey with this company">
      {steps.map((x, i) => (
        <li key={i} className={x.done ? "done" : x.now ? "now" : ""}>
          <span className="jn">{x.done ? "✓" : i + 1}</span>
          <div><b>{x.t}</b><p>{x.s}</p>{x.cta && x.cta.href !== "#" && <a className="btn sm" href={x.cta.href}>{x.cta.label}</a>}{x.cta && x.cta.href === "#" && <span className="fine">{x.cta.label}</span>}</div>
        </li>
      ))}
    </ol>
  );
}
