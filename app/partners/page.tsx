import type { Metadata } from "next";
import { pageMeta, faqLd, ld } from "@/lib/seo";

// Partner programme: wealth managers, RIAs, CAs, family-office advisers, private bankers and distributors who bring
// their clients to the desk's deals. An application is a lead for the desk (kind "partner"). Terms are in a written
// agreement shared after approval; nothing about fees or commissions is stated on the site.
const D = "For wealth managers, RIAs, chartered accountants, private bankers and family-office advisers: bring vetted pre-IPO rounds and IPO allocations to your clients, with the desk's diligence, data rooms and execution behind you.";
export const metadata: Metadata = pageMeta({ path: "/partners", title: "Partner with the desk", description: D });

const WHO = [
  ["Wealth managers and private bankers", "Offer HNI and UHNI clients pre-IPO rounds the desk has already vetted."],
  ["RIAs and financial planners", "Bring clients a private-markets sleeve with the documents to assess it."],
  ["Chartered accountants", "Introduce business-owner clients looking for pre-IPO exposure, or promoters looking to raise."],
  ["Family-office advisers", "Get the desk's deal flow for the principals you advise."],
  ["Distributors and broker networks", "Extend your shelf to pre-IPO and SME IPO allocations."],
];

const FAQ = `<div class="faq">
<details><summary>Who can become a partner?</summary><p>Wealth managers, private bankers, RIAs, financial planners, chartered accountants, family-office advisers and distributors who advise HNI, UHNI or family-office clients. The desk approves each partner after a call.</p></details>
<details><summary>What do my clients see?</summary><p>The same deals and data rooms as every approved investor: the company by name, the pitch deck, the NDA signed on screen, and a room with the numbers, the terms, the path to listing and the risks. Clients who register through your link are tagged to you on the desk.</p></details>
<details><summary>How are partners rewarded?</summary><p>Under a written partner agreement, shared once the desk approves you. Nothing is paid or charged before you sign it.</p></details>
<details><summary>Do my clients deal with the desk directly?</summary><p>You choose. Some partners stay in every conversation; others introduce the client and let the desk run the room, documents and allotment while keeping them informed.</p></details>
</div>`;

export default function Partners() {
  const faq = faqLd(FAQ);
  return (
    <main>
      <div className="wrap split rd-hero">
        <div>
          <span className="eyebrow">Partner programme</span>
          <h1 className="tt">Pre-IPO deals for your clients.<span className="tt2">With the desk's diligence behind you.</span></h1>
          <p className="lede" style={{ color: "var(--ink2)" }}>Before the Bell brings profitable, IPO-bound Indian companies to family offices and qualified investors. The desk vets every company, puts its own capital in before the round opens, and runs the data room, documents and allotment. Partners bring those deals to their own clients.</p>
          <ul className="ticks">
            <li>Vetted pre-IPO rounds, secondaries and SME IPO allocations, from ₹25 lakh a company.</li>
            <li>A data room for every deal: financials, terms, path to listing and risks.</li>
            <li>Your own registration link: clients who sign up through it are tagged to you on the desk.</li>
            <li>Terms in a written partner agreement, shared once the desk approves you.</li>
          </ul>
        </div>
        <div className="rd-card fd-card">
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
      </div>
      <section className="wrap sec tight">
        <span className="eyebrow">Who partners with the desk</span>
        <ul className="raise-more">{WHO.map(([t, s]) => <li key={t}><b>{t}.</b> {s}</li>)}</ul>
        <h2 style={{ fontSize: 24, marginTop: 28 }}>How it works</h2>
        <ol className="raise-more">
          <li><b>Apply.</b> A short call with the desk, then the partner agreement.</li>
          <li><b>Invite your clients.</b> Each client registers through your link and is approved by the desk.</li>
          <li><b>They see the deals.</b> Company by name, pitch deck, NDA on screen and the data room.</li>
          <li><b>The desk executes.</b> Documents, KYC and allotment, with you kept informed throughout.</li>
        </ol>
        <h2 style={{ fontSize: 24, marginTop: 28 }}>Questions partners ask</h2>
        <div dangerouslySetInnerHTML={{ __html: FAQ }} />
        <p className="fine" style={{ marginTop: 18 }}>Partners introduce clients; every offer is made by the company privately to identified investors under applicable law. Before the Bell is operated by SintraCap Advisors LLP and is not registered with SEBI.</p>
      </section>
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />}
    </main>
  );
}
