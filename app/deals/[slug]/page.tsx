import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getDeal, listDeals, signedDealIds, canSeeNames } from "@/lib/deals";
import { ScoreBadge } from "@/components/Score";
import { Journey } from "@/components/Journey";
import { getDb } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import { dealViews, documents } from "@/db/schema";
import { runwayHtml } from "@/lib/render";
import { isDesk } from "@/lib/perm";
import { NdaSign } from "@/components/NdaSign";
import { emailReady } from "@/lib/email";
import { trustedDevice } from "@/lib/trust";
import { getSettings } from "@/lib/settings";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const d = await getDeal((await params).slug);
  if (!d || !d.published) return {};
  return { title: `${d.title} · ${d.category}`, description: d.headline, openGraph: { title: `${d.title} · Before the Bell`, description: d.headline } };
}

export default async function Overview({ params }: P) {
  const { slug } = await params;
  const [user, d, all] = await Promise.all([getUser(), getDeal(slug), listDeals()]);
  if (!d || (!d.published && !isDesk(user))) notFound();
  const signed = (await signedDealIds(user?.officeId)).has(d.id) || isDesk(user);
  const registered = await canSeeNames(user);
  const canSign = !!user && !!user.office && registered && !signed && d.open && user.office.status !== "rejected";
  const trusted = canSign ? await trustedDevice(user!.id) : false;
  const approvalTime = (await getSettings()).approvalTime;
  const db = await getDb();
  if (!isDesk(user)) await db.insert(dealViews).values({ dealId: d.id, officeId: user?.officeId ?? null }).catch(() => {});
  // Layer 2: the pitch deck, IM or teaser, shown to approved investors before any NDA.
  const decks = registered ? await db.select().from(documents).where(and(eq(documents.dealId, d.id), eq(documents.audience, "approved"))).orderBy(asc(documents.sort), asc(documents.id)) : [];
  const layer = !user ? 0 : !registered ? 1 : !signed ? 2 : 3;
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
              <div className="gate open">
                <span className="k">{signed ? "Your NDA with this company is signed" : "For approved investors"}</span>
                <ul>
                  <li>Company<span className="v">{d.company}</span></li>
                  <li>Round<span className="v">{d.roundLabel || "—"}</span></li>
                  <li>Pre-money<span className="v">{d.preMoney || "—"}</span></li>
                  <li>P/E, trailing · forward<span className="v">{d.peLabel || "—"}</span></li>
                  <li>Pitch deck and information<span className="v"><a href="#deck">{decks.length ? "below" : "coming"}</a></span></li>
                </ul>
              </div>
              {signed ? <a className="btn primary" href={`/room/${d.slug}`}>Open the data room</a>
                : canSign ? <NdaSign deal={d} name={user!.name} office={user!.office!.name} email={user!.email} mailOn={emailReady()} trusted={trusted} />
                : <span className="btn" aria-disabled="true">Room not open yet</span>}
            </>
          ) : (
            <>
              <div className="gate">
                <span className="k"><span className="lock" /> Approved investors see</span>
                <ul>
                  <li>Company name<span className="v">Redacted</span></li>
                  <li>Round size and pre-money<span className="v">₹000 Cr</span></li>
                  <li>P/E, trailing and forward<span className="v">00x · 00x</span></li>
                  <li>Pitch deck and information<span className="v">on this page</span></li>
                  <li>Financials and data bank<span className="v">under NDA</span></li>
                </ul>
              </div>
              {user ? <p className="notice pend-note"><b>Your office is being approved</b>, {approvalTime}. We bring you back to this company the moment it is, to sign its NDA here.</p>
                : <a className="btn primary" href={`/register?next=${encodeURIComponent(`/deals/${d.slug}#sign`)}`}>Register to see the company</a>}
            </>
          )}
          {!registered && !user && <p className="fine">Register once. After the desk approves you, every company opens by name with its pitch deck; its data room opens when you sign that company&apos;s NDA, right on this page.</p>}
        </aside>
      </article>

      <section className="sec tight" style={{ paddingTop: 0 }} id="deck">
        <div className="sec-head rv inview"><div>
          <span className="eyebrow">{registered ? "Pitch deck and information" : "Three steps to the data room"}</span>
          <h2 style={{ fontSize: 26 }}>{registered ? (signed ? "What the company shared, before the NDA" : "Read the company's own material first") : "How this company opens up"}</h2>
          {registered && <p>{decks.length ? "The company's pitch deck, information memorandum or teaser, as the company presents itself. The desk's own findings, the financials and the data bank open under this company's NDA." : "The company's pitch deck or information memorandum will appear here once the desk has it. The desk's own findings, the financials and the data bank open under this company's NDA."}</p>}
        </div></div>
        {registered && decks.length > 0 && (
          <ul className="docs rv inview deck-list">{decks.map((doc) => {
            const live = doc.status === "available" && !!doc.url;
            return <li key={doc.id}><div><b>{doc.title}</b>{doc.kind && <small>{doc.kind}</small>}</div>
              {live ? <><span className="pill ok">Available</span><a className="btn sm" href={`/api/docs/${doc.id}`} target="_blank" rel="noopener">Open</a></> : <><span className="pill mid">Being uploaded</span><span className="fine">Soon</span></>}</li>;
          })}</ul>
        )}
        <Journey at={layer} slug={d.slug} canSign={canSign} open={d.open} />
      </section>

      <section className="sec tight" style={{ paddingTop: 0 }} id="desk-score">
        <div className="sec-head rv inview"><div>
          <span className="eyebrow">Curated by the desk</span>
          <h2 style={{ fontSize: 26 }}>How this company scores</h2>
          <p>Before it gets a room, every company goes through Before the Bell&apos;s proprietary diligence: site, factory and plant visits, customer orders verified, customer and supplier feedback taken and the numbers reconciled. The findings, the risks and the documents behind the score open in the room, under NDA.</p>
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
