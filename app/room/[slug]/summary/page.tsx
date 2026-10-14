import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getDeal, roomAccess } from "@/lib/deals";
import { Bars, barSeries } from "@/components/Charts";
import { ScoreBadge } from "@/components/Score";
import { GateCard } from "@/components/Gate";
import { isDesk } from "@/lib/perm";

type P = { params: Promise<{ slug: string }> };
export const metadata: Metadata = { title: "Deal summary", robots: { index: false } };
const PILL: Record<string, [string, string]> = { done: ["ok", "Done"], "in-progress": ["mid", "In progress"], pending: ["off", "Pending"] };

export default async function Summary({ params }: P) {
  const { slug } = await params;
  const [user, d] = await Promise.all([getUser(), getDeal(slug)]);
  if (!d || (!d.published && !isDesk(user))) notFound();
  const access = await roomAccess(user, d);
  if (access.state !== "open") {
    return <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}><GateCard deal={d} state={access.state} /></div></main>;
  }
  const r = d.room;
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <p className="crumb"><a href={`/room/${d.slug}`}>← Back to the deal room</a></p>
      <article className="memo">
        <header>
          <div><span className="eyebrow">Deal summary · prepared by Off Market Desk</span><h1>{d.company}</h1><p>{r.lede}</p></div>
          <div className="memometa"><span>{today}</span><span>Confidential · for {user?.office?.name || "the registered office"} only</span></div>
        </header>
        <section><h2>The transaction</h2><dl className="terms compact">{r.terms.slice(0, 6).map((t, i) => <div key={i}><dt>{t.k}</dt><dd>{t.v}</dd></div>)}</dl></section>
        <section><h2>Numbers</h2>
          <div className="charts even" style={{ marginBottom: 12 }}>
            {r.fin && <div className="chart"><span className="k">{barSeries(r.fin).map((x) => x.label).join(" and ")} · {r.fin.unit}</span><Bars fin={r.fin} /></div>}
            {d.score != null && <div className="chart"><span className="k">Desk Score</span><ScoreBadge score={d.score} /></div>}
          </div>
          <div className="snap compact">{r.snapshot.map((s, i) => <div key={i} className="snapcell"><span className="k">{s.k}</span><b>{s.v}</b>{s.s && <small>{s.s}</small>}</div>)}</div>
          {r.multiples.length > 0 && <div className="snap compact" style={{ marginTop: 10 }}>{r.multiples.map((s, i) => <div key={i} className="snapcell"><span className="k">{s.k}</span><b>{s.v}</b></div>)}</div>}
          {r.fin?.note && <p className="note">{r.fin.note}</p>}
        </section>
        <section><h2>Why it is on the desk</h2><p>{r.why}</p></section>
        <section><h2>Diligence status</h2><ul className="memolist">{r.checks.map((k, i) => <li key={i}><span className={`pill ${PILL[k.status][0]}`}>{PILL[k.status][1]}</span>{k.title}</li>)}</ul></section>
        <section><h2>Risks</h2><ul className="risks">{r.risks.map((x, i) => <li key={i}><b>{x.t}.</b> {x.d}</li>)}</ul></section>
        <section><h2>Path to listing</h2><ul className="memolist">{r.path.map((p, i) => <li key={i}><span className={`pill ${PILL[p.status][0]}`}>{PILL[p.status][1]}</span>{p.title} · {p.note}</li>)}</ul></section>
        <p className="fine">Prepared from the company&apos;s documents and the desk&apos;s tracker. Not a recommendation or investment advice; each office decides on the documents and its own advisers.</p>
        <div><button type="button" className="btn" data-print="">Print or save as PDF</button></div>
      </article>
    </div></main>
  );
}
