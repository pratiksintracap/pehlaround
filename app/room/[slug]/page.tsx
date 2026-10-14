import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gt, like, or, ne } from "drizzle-orm";
import { getUser, log } from "@/lib/auth";
import { getDeal, listDeals, signedDealIds, roomAccess, trackerCounts, docAccess, type Deal } from "@/lib/deals";
import { getDb } from "@/lib/db";
import { audit, dealPrefs, documents, interests, passes, questions } from "@/db/schema";
import { Donut, Ring, StatusBar, Bars, HBars, Timeline, barSeries } from "@/components/Charts";
import { ScoreBadge } from "@/components/Score";
import { GateCard } from "@/components/Gate";
import { Analyst } from "@/components/Analyst";
import { aiReady, starters } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { isDesk } from "@/lib/perm";

type P = { params: Promise<{ slug: string }> };
export const metadata: Metadata = { title: "Deal room", robots: { index: false } };

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const PILL: Record<string, [string, string]> = { done: ["ok", "Done"], "in-progress": ["mid", "In progress"], pending: ["off", "Pending"] };

export default async function Room({ params }: P) {
  const { slug } = await params;
  const [user, d] = await Promise.all([getUser(), getDeal(slug)]);
  if (!d || (!d.published && !isDesk(user))) notFound();
  const access = await roomAccess(user, d);

  if (access.state !== "open") {
    return (
      <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
        <div className="room" data-gate={slug}><GateCard deal={d} state={access.state} /></div>
      </div></main>
    );
  }

  const db = await getDb();
  const officeId = user!.officeId ?? -1;
  const [docs, qs, prefs, myInterest, myPass, allDeals, mine] = await Promise.all([
    db.select().from(documents).where(and(eq(documents.dealId, d.id), ne(documents.status, "proposed"))).orderBy(asc(documents.sort), asc(documents.id)),
    // private questions are visible only to the office that asked (and the desk)
    db.select().from(questions).where(and(eq(questions.dealId, d.id), eq(questions.hidden, false),
      access.admin ? undefined : or(eq(questions.private, false), eq(questions.officeId, officeId)))).orderBy(asc(questions.askedAt)),
    db.select().from(dealPrefs).where(and(eq(dealPrefs.dealId, d.id), eq(dealPrefs.officeId, officeId))),
    db.select().from(interests).where(and(eq(interests.dealId, d.id), eq(interests.officeId, officeId))).orderBy(desc(interests.createdAt)).limit(1),
    db.select().from(passes).where(and(eq(passes.dealId, d.id), eq(passes.officeId, officeId))).orderBy(desc(passes.createdAt)).limit(1),
    listDeals(), signedDealIds(user!.officeId),
  ]);
  // deals this office has passed on, to mark them in the switcher
  const [allPass, allAsk] = await Promise.all([
    db.select({ dealId: passes.dealId, at: passes.createdAt }).from(passes).where(eq(passes.officeId, officeId)),
    db.select({ dealId: interests.dealId, at: interests.createdAt }).from(interests).where(eq(interests.officeId, officeId)),
  ]);
  const passedIds = new Set(allPass.filter((p) => !allAsk.some((a) => a.dealId === p.dealId && a.at > p.at) && !allPass.some((q) => q.dealId === p.dealId && q.at > p.at)).map((p) => p.dealId));
  // other deals, for the switcher: rooms this office has opened first, then the rest of the shelf
  const others = allDeals.filter((x) => x.id !== d.id);
  const myRooms = others.filter((x) => mine.has(x.id)), rest = others.filter((x) => !mine.has(x.id));
  const idx = allDeals.findIndex((x) => x.id === d.id);
  const prevD = allDeals[(idx - 1 + allDeals.length) % allDeals.length], nextD = allDeals[(idx + 1) % allDeals.length];
  const hrefFor = (x: Deal) => (mine.has(x.id) || access.admin ? `/room/${x.slug}` : `/deals/${x.slug}`);
  // one "opened" entry per user and deal per 15 minutes keeps the office's log readable
  const recent = await db.select({ id: audit.id }).from(audit).where(and(eq(audit.userId, user!.id), eq(audit.dealId, d.id), like(audit.action, "Opened the room%"), gt(audit.at, new Date(Date.now() - 900e3)))).limit(1);
  if (!recent.length) await log(user, `Opened the room: ${d.company}`, d.id);

  const r = d.room, c = trackerCounts(d);
  // until an office chooses, every alert is on
  const alertsOn = new Set(prefs[0]?.alertsSet ? prefs[0].alerts : r.alerts), ticks = new Set(prefs[0]?.ticks ?? []);
  const inter = myInterest[0], passed = myPass[0];
  // the office's latest word: a pass counts unless it asked for an allocation afterwards
  const passedNow = passed && (!inter || inter.createdAt < passed.createdAt) ? passed : null;
  const it = r.interest;
  const fmtAmt = (a: number) => a < 1 ? `₹${Math.round(a * 100)} L` : `₹${a} Cr`;
  const def = inter ? Number(inter.amountCr) : it.def;
  const stakeLine = it.price && it.sharesCr
    ? `≈ ${((def * 100) / it.price).toFixed(2)} lakh shares at ₹${it.price} · ${((def / (it.sharesCr * it.price)) * 100).toFixed(2)}% of the company`
    : it.postCr ? `≈ ${((def / it.postCr) * 100).toFixed(2)}% of the company, post-money` : "";

  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <div className="room" data-room={d.slug}>
        <nav className="dealswitch" aria-label="Switch deal">
          <a className="btn sm ghost" href="/dashboard">← Your office</a>
          <div className="ds-mid">
            {others.length > 0 && <a className="btn sm ghost" href={hrefFor(prevD)} title={prevD.company} aria-label={`Previous deal: ${prevD.company}`}>‹</a>}
            <details className="ds-menu"><summary className="btn sm">Switch deal <span aria-hidden="true">▾</span></summary>
              <div className="ds-list">
                {myRooms.length > 0 && <><span className="k">Your rooms</span>{myRooms.map((x) => <a key={x.id} href={`/room/${x.slug}`}><b>{x.company}{passedIds.has(x.id) && <> <span className="pill off">Passed</span></>}</b><small>{x.category}{x.score != null ? ` · Desk Score ${x.score.toFixed(1)}` : ""}</small></a>)}</>}
                {rest.length > 0 && <><span className="k">{myRooms.length ? "Rest of the shelf" : "On the shelf"}</span>{rest.map((x) => <a key={x.id} href={hrefFor(x)}><b>{x.company}</b><small>{x.category}{x.open ? " · sign its NDA to open the room" : " · room not open yet"}</small></a>)}</>}
              </div>
            </details>
            {others.length > 0 && <a className="btn sm ghost" href={hrefFor(nextD)} title={nextD.company} aria-label={`Next deal: ${nextD.company}`}>›</a>}
          </div>
        </nav>
        <div className="roomwrap">
          <div className="roomhead">
            <div>
              <span className="eyebrow live">Deal room · {d.category}</span>
              <h1>{d.company}</h1>
              <p className="lede">{r.lede}</p>
              {passedNow && <p className="passnote"><span className="pill off">Passed</span> Your office passed on {fmtD(passedNow.createdAt)}: “{passedNow.reason}”. The room stays open to you; you can still ask questions or request an allocation.</p>}
              {access.admin && <p className="fine">You are viewing as the desk (admin).</p>}
            </div>
            <div className="roomside">
              <div className="kv"><span>Round</span><b>{r.round}</b></div>
              <div className="kv"><span>Family office ticket</span><b>{r.ticket}</b></div>
              {r.committed && <div className="kv"><span>Committed</span><b>{r.committed}</b></div>}
              <div className="kv"><span>Status</span><b>{d.status}</b></div>
              {d.score != null && <div className="kv"><span>Desk Score</span><b>{d.score.toFixed(1)} / 10</b></div>}
              <a className="btn primary" href={`/room/${d.slug}/summary`}>Deal summary (one page)</a>
            </div>
          </div>
          <div className="undisc"><span className="k">Why it is on the desk</span><p>{r.why}</p></div>

          <div className="tabs" role="tablist">
            {["Overview", "Financials", "Terms", "IPO path", "Diligence", "Documents", "Q&A"].map((t, i) =>
              <button key={t} role="tab" type="button" data-tab={t} aria-selected={i === 0} className="tabbtn">{t}</button>)}
          </div>

          <section className="panel" data-panel="Overview">
            <div className="snap">{r.snapshot.map((s, i) => <div key={i} className="snapcell"><span className="k">{s.k}</span><b>{s.v}</b>{s.s && <small>{s.s}</small>}</div>)}</div>
            <div className="charts">
              {r.highlight ? (
                <div className="chart"><span className="k">{r.highlight.title}</span>
                  <div className="donut" role="img" aria-label={r.highlight.title}><Donut h={r.highlight} />
                    <ul className="legend"><li><i className="c1" /><span>{r.highlight.a.label}</span><b>₹{r.highlight.a.value.toLocaleString("en-IN")} Cr</b></li><li><i className="cl" /><span>{r.highlight.b.label}</span><b>₹{r.highlight.b.value.toLocaleString("en-IN")} Cr</b></li></ul>
                  </div>
                  <p className="fine">{r.highlight.note}</p>
                </div>
              ) : r.fin ? (
                <div className="chart"><span className="k">{barSeries(r.fin).map((x) => x.label).join(" and ")} · {r.fin.unit}</span><Bars fin={r.fin} /></div>
              ) : null}
              <div className="chart"><span className="k">Desk Score</span>
                {d.score != null ? <ScoreBadge score={d.score} size="lg" /> : <p className="fine">The desk is completing its assessment.</p>}
                {r.stake && (
                  <div className="stake" style={{ marginTop: 6 }}><span className="k">Stake on offer</span>
                    <div className="bar" role="img" aria-label={`${((r.stake.sizeCr / r.stake.postCr) * 100).toFixed(1)} percent of the company`}><i style={{ width: `${(r.stake.sizeCr / r.stake.postCr) * 100}%` }} /></div>
                    <div className="k fine"><span>₹{r.stake.sizeCr} Cr of ₹{r.stake.postCr.toLocaleString("en-IN")} Cr{d.category.includes("secondary") ? "" : " post-money"}</span><b style={{ color: "var(--ink)" }}>≈ {((r.stake.sizeCr / r.stake.postCr) * 100).toFixed(1)}% of the company</b></div>
                  </div>
                )}
              </div>
            </div>
            <div className="two">
              <div><h3>Key risks the desk flags</h3><ul className="risks">{r.risks.map((x, i) => <li key={i}><b>{x.t}.</b> {x.d}</li>)}</ul></div>
              <div><h3>What changed</h3><ul className="feed">{r.feed.map((f, i) => <li key={i}><span className="mono">{f.date}</span>{f.text}</li>)}</ul></div>
            </div>
          </section>

          <section className="panel" data-panel="Financials" hidden>
            {r.fin && <>
              <div className="charts">
                <div className="chart"><span className="k">Revenue and PAT · {r.fin.unit}</span><Bars fin={r.fin} /></div>
                {r.pe && r.pe.length > 0 && <div className="chart"><span className="k">Implied P/E at the offered price</span><HBars items={r.pe} /><p className="fine">Lower is cheaper. Forward figures depend on the company&apos;s projection being met.</p></div>}
              </div>
              <div style={{ overflowX: "auto" }}><table className="fin"><thead><tr><th />{r.fin.cols.map((x) => <th key={x}>{x}</th>)}</tr></thead>
                <tbody>{r.fin.rows.map((row, i) => <tr key={i}><td>{row.label}</td>{r.fin!.cols.map((_, j) => <td key={j}>{row.vals[j] ?? "—"}</td>)}</tr>)}</tbody></table></div>
              {r.fin.note && <p className="note">{r.fin.note}</p>}
            </>}
            {r.multiples.length > 0 && <>
              <h3 style={{ marginTop: 22 }}>Implied multiples at the offered price</h3>
              <div className="snap">{r.multiples.map((s, i) => <div key={i} className="snapcell"><span className="k">{s.k}</span><b>{s.v}</b>{s.s && <small>{s.s}</small>}</div>)}</div>
            </>}
            {r.peers && <p className="note">Listed peers for your own comparison: {r.peers}. The desk does not publish a view on whether the multiple is fair.</p>}
          </section>

          <section className="panel" data-panel="Terms" hidden>
            <dl className="terms">{r.terms.map((t, i) => <div key={i}><dt>{t.k}</dt><dd>{t.v}</dd></div>)}</dl>
          </section>

          <section className="panel" data-panel="IPO path" hidden>
            <div className="chart" style={{ overflowX: "auto" }}><Timeline path={r.path} /></div>
            <ol className="path">{r.path.map((p, i) => (
              <li key={i} className={p.status}><span className="dot" /><div><b>{p.title}</b><small>{p.note}</small></div><span className={`pill ${PILL[p.status][0]}`}>{PILL[p.status][1]}</span></li>
            ))}</ol>
          </section>

          <section className="panel" data-panel="Diligence" hidden>
            <p className="fine" style={{ marginBottom: 12 }}>What the desk has verified, is verifying, or has not started. Facts, not opinions; dates are when the item was completed. More checks are added where the company, sector or history calls for them.</p>
            <div className="chart" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}><Ring done={c.done} total={c.total} size={104} />
              <div style={{ flex: 1, minWidth: 220 }}><StatusBar done={c.done} prog={c.prog} pend={c.pend} /></div></div>
            <ul className="checks">{r.checks.map((k, i) => (
              <li key={i}><span className={`pill ${PILL[k.status][0]}`}>{PILL[k.status][1]}</span><div><b>{k.title}</b>{k.note && <small>{k.note}</small>}</div><span className="mono">{k.date || ""}</span></li>
            ))}</ul>
            <div className="mine"><h3>Your office&apos;s checklist <small>{r.mine.filter((m) => ticks.has(m)).length}/{r.mine.length}</small></h3>
              {r.mine.map((m) => <label key={m} className="chk"><input type="checkbox" data-tick={m} defaultChecked={ticks.has(m)} />{m}</label>)}</div>
          </section>

          <section className="panel" data-panel="Documents" hidden>
            <ul className="docs">{docs.map((doc) => {
              const acc = docAccess(doc, user?.officeId, !!inter && inter.status !== "Withdrawn", !!access.admin);
              if (acc === "no") return null;
              const live = doc.status === "available" && !!doc.url;
              return (
                <li key={doc.id}><div><b>{doc.title}</b>{doc.kind && <small>{doc.kind}</small>}
                  {access.admin && doc.audience !== "nda" && <small className="mono">{doc.audience === "allocation" ? "Only offices that requested an allocation" : `Only ${(doc.officeIds || []).length} selected office(s)`}</small>}</div>
                  {live && acc === "after-allocation" ? <><span className="pill mid">After allocation request</span><span className="fine">Opens once your office requests an allocation</span></>
                  : live ? <><span className="pill ok">Available</span><a className="btn sm" href={`/api/docs/${doc.id}`} target="_blank" rel="noopener">View</a></>
                    : doc.status === "on_request" ? <><span className="pill mid">On request</span><span className="fine">Shared once you indicate interest</span></>
                    : doc.status === "available" ? <><span className="pill mid">Being uploaded</span><a className="fine" href={`/dashboard?cat=documents&deal=${d.slug}#Support`}>Ask the desk</a></>
                    : <><span className="pill off">Pending</span><span className="fine">Requested</span></>}
                </li>
              );
            })}</ul>
            <p className="note">Documents are for your office&apos;s evaluation under this NDA. Every view is logged against your name and office.</p>
          </section>

          <section className="panel" data-panel="Q&A" hidden>
            <ul className="qa">{qs.map((q) => (
              <li key={q.id}><b>{q.question}</b>{q.private && <> <span className="pill mid">{q.officeId === officeId ? "Private to your office" : "Private · asked by one office"}</span></>}
                {q.answer ? <p>{q.answer}<small> — {q.answeredBy || "Desk"}, {fmtD(q.answeredAt)}</small></p>
                  : <p className="fine">Asked {fmtD(q.askedAt)}. Awaiting the promoter; {q.private ? "the answer is shown only to your office." : "answers are posted here for every office in this room."}</p>}
              </li>
            ))}</ul>
            <form className="form askform"><label>Ask the promoter<textarea name="q" rows={2} placeholder="Answered in writing in this room" /></label>
              <label className="chk"><input type="checkbox" name="private" /> <span><b>Ask privately.</b> Only your office sees this question and its answer; the promoter is told which office asked. Leave unticked to share the answer with every office in the room.</span></label>
              <div><button className="btn" type="submit">Submit question</button></div></form>
            <div className="callbox" id="call"><h3>Request a management call</h3>
              <p className="fine">Calls are group sessions under the NDA. Information that will not appear in the offer documents is not shared on calls, and a written summary is posted to this room for every office.</p>
              <form className="form" id="callform" noValidate>
                <div className="row">
                  <label>Preferred slot<select required name="slot" defaultValue=""><option value="" disabled>Select</option><option>Weekday morning</option><option>Weekday afternoon</option><option>Weekday evening</option></select></label>
                  <label>Attendees from the office<input name="who" required placeholder="e.g. Principal, CIO, CA" /></label>
                </div>
                <label>Questions in advance<textarea name="qs" rows={2} placeholder="Shared with the company before the call" /></label>
                <div><button className="btn primary" type="submit">Request call</button></div><div className="ok" role="status" />
              </form>
            </div>
          </section>

          <aside className="interest" id="interest">
            <div><span className="eyebrow">Indicate interest</span><h3>Request an allocation</h3>
              <p className="fine">{it.note}</p>
              {inter && <p className="fine"><b>Your office requested {fmtAmt(Number(inter.amountCr))} on {fmtD(inter.createdAt)}</b> · {inter.status}</p>}</div>
            <div className="amt" data-price={it.price ?? ""} data-shares={it.sharesCr ?? ""} data-post={it.postCr ?? ""}>
              <label>Amount <b id="amtval">{fmtAmt(def)}</b></label>
              <input type="range" data-ticket="" min={it.min} max={it.max} step={it.step} defaultValue={def} />
              <div className="amtrow"><span>{fmtAmt(it.min)}</span><span>{fmtAmt(it.max)}</span></div>
              {stakeLine && <p className="fine" id="amtstake" style={{ marginTop: 8 }}>{stakeLine}</p>}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {it.colead && <label className="chk"><input type="checkbox" name="colead" defaultChecked={!!inter?.colead} />Interested in a co-lead position</label>}
              <button type="button" className="btn primary" data-request={d.slug}>{inter ? "Update request" : "Request allocation"}</button>
            </div>
          </aside>

          {r.scenario && <Scenario d={d} ticket={def} />}

          <section className="passbox" id="passbox" data-deal={d.slug}>
            <div><span className="eyebrow">Not for your office?</span><h3>Pass, and say why</h3>
              <p className="fine">{passed ? `Your office passed on ${fmtD(passed.createdAt)}: “${passed.reason}”. ` : ""}Goes into your dashboard. The promoter never sees your name, nobody calls to change your mind, and the shelf learns what your office does not want.</p></div>
            <form className="form passform">
              <select name="why" aria-label="Reason for passing" defaultValue=""><option value="" disabled>Reason</option>{r.passReasons.map((p) => <option key={p}>{p}</option>)}</select>
              <input placeholder="One line, optional" name="note" /><button type="submit" className="btn" data-pass="true">Pass on this deal</button>
            </form>
          </section>

          <section className="alerts" id="alerts" data-deal={d.slug}>
            <div><span className="eyebrow">Alerts for your office</span><h3>Tell me when</h3>
              <p className="fine">Every update on this room lands under the bell <span aria-hidden="true">🔔</span> at the top of the site and in the app, for everyone in your office. The ones switched on here also come by email to your office&apos;s team{user!.office?.consents?.email === false ? " once you switch email back on in Team and profile" : ""}. All are on until you choose.</p></div>
            <div className="alert-chips">{r.alerts.map((a) => <button key={a} type="button" className="chip" data-alert={a} aria-pressed={alertsOn.has(a)}>{a}</button>)}</div>
          </section>
        </div>
      </div>
    </div>
    {aiReady() && (await getSettings()).aiAnalyst && <Analyst deal={{ slug: d.slug, company: d.company }} starters={starters(d)} who={user!.name} />}
    </main>
  );
}

function Scenario({ d, ticket }: { d: Deal; ticket: number }) {
  const it = d.room.interest;
  const fmtAmt = (a: number) => a < 1 ? `₹${Math.round(a * 100)} L` : `₹${a} Cr`;
  const s = d.room.scenario!;
  const valuation = !(s.price && s.sharesCr);
  const entry = valuation ? `₹${s.postCr} Cr post-money` : `₹${s.price} a share`;
  return (
    <section className="scenario" id="scenario" data-pat={s.pat} data-shares={s.sharesCr ?? ""} data-price={s.price ?? ""} data-post={s.postCr ?? ""} data-months={s.months}>
      <div className="scen-head"><div><span className="eyebrow">Your scenario</span><h3>What would this be worth at listing, on your assumptions?</h3>
        <p className="fine">Move the sliders. The desk supplies the room&apos;s figures ({s.patLabel}, entry at {entry}, exit {s.months} months out: {s.monthsNote}); the assumptions are yours. Not a forecast and not advice; no growth beyond that year is assumed.</p></div></div>
      <div className="scen-grid">
        <div className="scen-inputs">
          <label><span>Projected PAT actually achieved <b data-out="ach">100%</b></span><input type="range" min="50" max="130" step="5" name="ach" defaultValue="100" /><small><span>50%</span><span>130%</span></small></label>
          <label><span>Exit P/E at listing <b data-out="pe">{s.peDefault}x</b></span><input type="range" min="6" max="45" step="1" name="pe" defaultValue={s.peDefault} /><small><span>6x</span><span>45x</span></small></label>
          <label><span>Your ticket <b data-out="amt">{fmtAmt(ticket)}</b></span><input type="range" data-ticket="" min={it.min} max={it.max} step={it.step} name="amt" defaultValue={ticket} /><small><span>{fmtAmt(it.min)}</span><span>{fmtAmt(it.max)}</span></small></label>
        </div>
        <div className="scen-out">
          <div className="snapcell"><span className="k">Implied value at exit</span><b data-out="value">—</b><small data-out="vsub" /></div>
          <div className="snapcell"><span className="k">Multiple on money</span><b data-out="moic">—</b><small>before tax and costs</small></div>
          <div className="snapcell"><span className="k">Implied IRR</span><b data-out="irr">—</b><small data-out="isub">over {s.months} months</small></div>
          <div className="snapcell"><span className="k">Entry vs exit P/E</span><b data-out="pes">—</b><small>on the same PAT line</small></div>
        </div>
      </div>
      <div className="scen-bar" aria-hidden="true"><span className="k sb-title">Your ticket and what it is worth at exit</span><div className="track"><i data-out="bar" /></div><div className="k"><span data-out="entrylbl">Your ticket</span><span data-out="exitpx">Worth at exit</span></div><p className="fine">The same ticket as the allocation slider above: move either one. Entry at {entry}.</p></div>
    </section>
  );
}
