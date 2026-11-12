import type { Metadata } from "next";
import { pageMeta, faqLd, ld } from "@/lib/seo";
import { listDeals, listUpcoming } from "@/lib/deals";

// Partner programme: wealth managers, RIAs, CAs, family-office advisers, private bankers and distributors who bring
// their clients to the desk's deals. An application is a lead for the desk (kind "partner"). Terms are in a written
// agreement shared after approval; nothing about fees or commissions is stated on the site. What the page shows of the
// desk (rounds open, coming, structures) is the same anonymised information as the public shelf.
const D = "For wealth managers, RIAs, chartered accountants, private bankers and family-office advisers: bring vetted pre-IPO rounds and IPO allocations to your clients, with the desk's diligence, data rooms and execution behind you.";
export const metadata: Metadata = pageMeta({ path: "/partners", title: "Partner with the desk", description: D });
export const revalidate = 600;

const GET: [string, string, string][] = [
  ["M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z", "Deals your clients can't get elsewhere", "Profitable, IPO-bound companies the desk finds before they are widely marketed. Not the names already on every unlisted-share app."],
  ["M9 12l2 2 4-4M5 4h14v16H5z", "The diligence is done before you pitch", "Plant visits, customer orders checked, numbers reconciled and a Desk Score for every company. You bring the client; the desk brings the conviction."],
  ["M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1", "Your own links, for every issue", "A registration link for you and each of your relationship managers, and a ready-to-share link for each live deal, straight to WhatsApp."],
  ["M4 19V9M10 19V5M16 19v-7M22 19H2", "A partner desk of your own", "Your clients, the companies they are looking at, what they have asked for and allotted, and your progress on each issue. Updated live."],
  ["M3 17l6-6 4 4 8-8M15 7h6v6", "Pre-IPO to listing day", "When a company on the desk goes public, your clients register IPO interest and you see the book. One relationship, the whole journey."],
  ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", "Your clients stay yours", "Every client who joins through your link is tagged to you for good. Their documents and questions stay private; you see what you need to serve them."],
];

const STEPS: [string, string][] = [
  ["Apply", "Two minutes, below. A banker calls you within two working days."],
  ["Sign the partner agreement", "Your terms, in writing, before anything else."],
  ["Share your link", "Clients register through it and the desk approves them."],
  ["They invest, you track it", "NDA on screen, data room, allotment. You see every step on your partner desk."],
];

const WHO = ["Wealth managers", "Private bankers", "RIAs and planners", "Chartered accountants", "Family-office advisers", "Brokers and distributors"];

const FAQ = `<div class="faq">
<details><summary>Who can become a partner?</summary><p>Wealth managers, private bankers, RIAs, financial planners, chartered accountants, family-office advisers and distributors who advise HNI, UHNI or family-office clients. The desk approves each partner after a call.</p></details>
<details><summary>What do my clients see?</summary><p>The same deals and data rooms as every approved investor: the company by name, the pitch deck, the NDA signed on screen, and a room with the numbers, the terms, the path to listing and the risks. Clients who register through your link are tagged to you on the desk.</p></details>
<details><summary>How are partners rewarded?</summary><p>Under a written partner agreement, shared once the desk approves you. Nothing is paid or charged before you sign it.</p></details>
<details><summary>Can my relationship managers have their own links?</summary><p>Yes. Add them to your firm and each gets a link of their own. As the principal you see every client and every RM; each RM sees only the clients they brought.</p></details>
<details><summary>Do my clients deal with the desk directly?</summary><p>You choose. Some partners stay in every conversation; others introduce the client and let the desk run the room, documents and allotment while keeping them informed.</p></details>
</div>`;

const ic = (d: string) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default async function Partners() {
  const faq = faqLd(FAQ);
  const [live, coming] = await Promise.all([listDeals(), listUpcoming()]);
  const open = live.filter((d) => d.phase === "open");
  const show = [...open, ...live.filter((d) => d.phase !== "open"), ...coming].slice(0, 4);
  const sectors = new Set([...live, ...coming].map((d) => d.category)).size;

  return (
    <main className="ptn">
      <section className="pt-hero">
        <div className="wrap pt-hero-in">
          <div>
            <span className="pt-kick">Partner programme</span>
            <h1>Your clients are asking about pre-IPO.<span>Now you have the answer.</span></h1>
            <p className="pt-lede">Bring your clients vetted rounds in India&apos;s next listings, under your relationship. The desk finds the companies, does the diligence, puts its own capital in first and runs the paperwork. You keep the client.</p>
            <div className="pt-ctas"><a className="pt-btn" href="#apply">Apply to partner</a><a className="pt-btn ghost" href="#get">See what you get</a></div>
            <ul className="pt-proof">
              <li><b>{open.length || live.length}</b><span>{open.length ? (open.length === 1 ? "round open now" : "rounds open now") : "companies on the desk"}</span></li>
              <li><b>8.0+</b><span>Desk Score on every deal shown</span></li>
              <li><b>₹25 lakh</b><span>tickets from</span></li>
            </ul>
          </div>
          <div className="pt-mock" aria-label="An illustration of the partner desk">
            <div className="pt-mock-top"><i /><i /><i /><span>Your partner desk</span><em>Sample</em></div>
            <div className="pt-mock-kpi">
              <div><small>Clients</small><b>14</b></div><div><small>Introductions</small><b>9</b></div><div><small>Requested</small><b>₹6.5 Cr</b></div>
            </div>
            <div className="pt-mock-rows">
              {[["Specialty chemicals, Gujarat", 80], ["Defence electronics, Maharashtra", 55], ["Packaged foods, Rajasthan", 30]].map(([t, p]) => (
                <div key={t as string}><span>{t}</span><i><i style={{ width: `${p}%` }} /></i><small>{p}% of target</small></div>))}
            </div>
            <div className="pt-mock-share"><span>Your link · Specialty chemicals</span><b>WhatsApp</b></div>
          </div>
        </div>
      </section>

      {show.length > 0 && <section className="wrap pt-live">
        <div className="pt-head"><span className="eyebrow">On the desk now</span><h2>What your clients would see this week</h2>
          <p>{live.length} {live.length === 1 ? "company" : "companies"} on the desk{coming.length ? ` and ${coming.length} coming` : ""}, across {sectors} {sectors === 1 ? "structure" : "structures"}: pre-IPO primaries, secondaries and growth rounds. Names open to approved investors only.</p></div>
        <div className="pt-deals">{show.map((d) => (
          <a key={d.id} className="pt-deal" href={d.published ? `/deals/${d.slug}` : "/deals"}>
            <span className={`pt-tag ${d.phase === "open" ? "on" : ""}`}>{d.phase === "open" ? "Round open" : d.published ? "On the desk" : "Coming"}</span>
            <b>{d.title}</b><small>{d.category}{d.listingLabel ? ` · listing ${d.listingLabel}` : ""}</small></a>))}</div>
      </section>}

      <section className="wrap pt-get" id="get">
        <div className="pt-head"><span className="eyebrow">What you get</span><h2>Everything to put a pre-IPO sleeve in front of your clients</h2></div>
        <div className="pt-grid">{GET.map(([d, t, s]) => <article key={t}><span className="pt-ic">{ic(d)}</span><h3>{t}</h3><p>{s}</p></article>)}</div>
      </section>

      <section className="pt-band">
        <div className="wrap">
          <div className="pt-head"><span className="pt-kick">How it works</span><h2>From application to your first allotment</h2></div>
          <ol className="pt-steps">{STEPS.map(([t, s], i) => <li key={t}><span>{String(i + 1).padStart(2, "0")}</span><b>{t}</b><p>{s}</p></li>)}</ol>
        </div>
      </section>

      <section className="wrap pt-apply" id="apply">
        <div className="pt-apply-copy">
          <span className="eyebrow">Apply</span>
          <h2>Bring your clients India&apos;s next listings.</h2>
          <p>Tell the desk about your practice. A banker calls within two working days to walk you through the deals on the desk and the partner agreement.</p>
          <ul className="pt-who">{WHO.map((w) => <li key={w}>{w}</li>)}</ul>
          <p className="fine">Terms are in a written partner agreement, shared once the desk approves you. Nothing is paid or charged before you sign it.</p>
        </div>
        <div className="pt-form">
          <form className="form" noValidate data-lead="partner" data-ok="Received. The desk will call within two working days to talk through the programme.">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
            <div className="row"><label>Your name<input required name="name" autoComplete="name" /></label><label>Firm<input required name="entity" autoComplete="organization" /></label></div>
            <div className="row"><label>Email<input type="email" required name="email" autoComplete="email" /></label><label>Mobile<input type="tel" required name="phone" placeholder="+91" autoComplete="tel" /></label></div>
            <div className="row">
              <label>You are<select name="role" required defaultValue=""><option value="" disabled>Select</option><option>Wealth manager</option><option>Private banker</option><option>RIA or financial planner</option><option>Chartered accountant</option><option>Family-office adviser</option><option>Distributor or broker</option><option>Other</option></select></label>
              <label>City<input required name="city" placeholder="e.g. Mumbai" /></label>
            </div>
            <div className="row">
              <label>Clients you advise<select name="clients" required defaultValue=""><option value="" disabled>Select</option><option>Under 25</option><option>25–100</option><option>100–500</option><option>Above 500</option></select></label>
              <label>Assets you advise on<select name="aum" required defaultValue=""><option value="" disabled>Select</option><option>Under ₹50 Cr</option><option>₹50–250 Cr</option><option>₹250–1,000 Cr</option><option>Above ₹1,000 Cr</option></select></label>
            </div>
            <label>SEBI or other registration (optional)<input name="registration" placeholder="e.g. RIA, ARN or CA membership number" /></label>
            <label>Anything else (optional)<textarea name="note" rows={2} placeholder="The kind of clients you advise, and what they look for" /></label>
            <div><button className="btn primary" type="submit">Apply to partner</button></div>
            <div className="ok" role="status" />
          </form>
        </div>
      </section>

      <section className="wrap sec tight">
        <h2 style={{ fontSize: 24 }}>Questions partners ask</h2>
        <div dangerouslySetInnerHTML={{ __html: FAQ }} />
        <p className="fine" style={{ marginTop: 18 }}>Partners introduce clients; every offer is made by the company privately to identified investors under applicable law. Before the Bell is operated by SintraCap Advisors LLP and is not registered with SEBI.</p>
      </section>
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />}
    </main>
  );
}
