import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getDeal, listDeals, signedDealIds, canSeeNames } from "@/lib/deals";
import { ScoreBadge } from "@/components/Score";
import { getDb } from "@/lib/db";
import { dealViews } from "@/db/schema";
import { runwayHtml } from "@/lib/render";
import { isDesk } from "@/lib/perm";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const d = await getDeal((await params).slug);
  if (!d || !d.published) return {};
  return { title: `${d.title} · ${d.category}`, description: d.headline, openGraph: { title: `${d.title} · Off Market Desk`, description: d.headline } };
}

export default async function Overview({ params }: P) {
  const { slug } = await params;
  const [user, d, all] = await Promise.all([getUser(), getDeal(slug), listDeals()]);
  if (!d || (!d.published && !isDesk(user))) notFound();
  const signed = (await signedDealIds(user?.officeId)).has(d.id) || isDesk(user);
  const registered = await canSeeNames(user);
  if (!isDesk(user)) await (await getDb()).insert(dealViews).values({ dealId: d.id, officeId: user?.officeId ?? null }).catch(() => {});
  const stages = ["Overview", "Room open", "Closing"];
  const now = d.open ? "Room open" : "Overview";
  const others = all.filter((x) => x.id !== d.id);

  return (
    <main><div className="wrap">
      <p className="crumb rv inview"><a href="/deals">← All deals</a></p>
      <article className="detail">
        <div className="rv inview">
          <div style={{ position: "relative" }}>
            <figure className="deal-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d.art || "" }} />
            <span className="tag">{d.category}</span><span className="tag stage">{d.stage}</span>
          </div>
          <span className="eyebrow" style={{ display: "block", marginTop: 22 }}>{d.category}</span>
          <h1>{registered ? d.company : d.title}</h1>
          {registered && <p className="fine">{d.title}</p>}
          <p className="note">{d.headline}</p>
          <div style={{ marginTop: 22, maxWidth: 520 }} dangerouslySetInnerHTML={{ __html: runwayHtml(d) }} />
          <ol className="stagebar" style={{ padding: 0 }} aria-label={`Stage: ${now}`}>
            {stages.map((s) => <li key={s} className={s === now ? "now" : ""}>{s}</li>)}
          </ol>
        </div>
        <aside className="side rv inview" style={{ ["--d" as string]: ".1s" }}>
          <dl className="facts">
            <div><dt>Target listing</dt><dd className="big">{d.listingLabel}</dd></div>
            <div><dt>Structure</dt><dd>{d.category}</dd></div>
            <div><dt>Status</dt><dd>{d.status}</dd></div>
            <div><dt>Shares</dt><dd>Demat · ISIN active</dd></div>
          </dl>
          {registered ? (
            <>
              <div className="gate">
                <span className="k">{signed ? "Your office's NDA with this company is signed" : "For registered family offices"}</span>
                <ul>
                  <li>Company<span className="v">{d.company}</span></li>
                  <li>Round<span className="v">{d.roundLabel || "—"}</span></li>
                  <li>Pre-money<span className="v">{d.preMoney || "—"}</span></li>
                  <li>P/E, trailing · forward<span className="v">{d.peLabel || "—"}</span></li>
                </ul>
              </div>
              {signed ? <a className="btn primary" href={`/room/${d.slug}`}>Open the deal room</a>
                : d.open ? <a className="btn primary" href={`/nda/${d.slug}`}>Sign this company&apos;s NDA to open the room</a>
                : <span className="btn" aria-disabled="true">Room not open yet</span>}
            </>
          ) : (
            <>
              <div className="gate">
                <span className="k"><span className="lock" /> Registered family offices see</span>
                <ul>
                  <li>Company name<span className="v">Redacted</span></li>
                  <li>Round size and pre-money<span className="v">₹000 Cr</span></li>
                  <li>P/E, trailing and forward<span className="v">00x · 00x</span></li>
                  <li>Financials and documents<span className="v">in the room</span></li>
                </ul>
              </div>
              {user ? <span className="btn" aria-disabled="true">Your office is being approved</span>
                : <a className="btn primary" href={`/register?next=${encodeURIComponent(`/deals/${d.slug}`)}`}>Register to see the company</a>}
            </>
          )}
          <p className="fine">No fee for family offices, on any deal. Register once; after the desk approves your office, you can open this company&apos;s room by signing its NDA on screen.</p>
        </aside>
      </article>

      <section className="sec tight" style={{ paddingTop: 0 }} id="desk-score">
        <div className="sec-head rv inview"><div>
          <span className="eyebrow">Curated by the desk</span>
          <h2 style={{ fontSize: 26 }}>How this company scores</h2>
          <p>Before it gets a room, every company goes through Off Market Desk&apos;s proprietary diligence: site, factory and plant visits, customer orders verified, customer and supplier feedback taken and the numbers reconciled. The findings, the risks and the documents behind the score open in the room, under NDA.</p>
        </div></div>
        <div className="chart rv inview">
          {d.score != null ? <ScoreBadge score={d.score} /> : <p className="fine">The desk is completing its assessment of this company.</p>}
          {d.asOf && <p className="fine" style={{ marginTop: 10 }}>As of {d.asOf}.</p>}
        </div>
      </section>

      {others.length > 0 && (
        <section className="sec tight" style={{ paddingTop: 0 }}>
          <div className="sec-head rv inview"><div><span className="eyebrow">Also on the desk</span><h2 style={{ fontSize: 26 }}>Other deals</h2></div></div>
          <ul className="more rv inview">
            {others.map((o) => <li key={o.id}><a href={`/deals/${o.slug}`}><span className="s">{o.title}</span><span className="f">{o.category} · {o.stage}</span></a></li>)}
          </ul>
        </section>
      )}
    </div></main>
  );
}
