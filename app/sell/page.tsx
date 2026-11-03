import type { Metadata } from "next";
import { pageMeta, faqLd, ld } from "@/lib/seo";

// Sell-side intake: early investors, angels, employees and family offices who hold pre-IPO or unlisted shares and want
// to sell before the listing. A lead for the desk (kind "seller"), never a public price or a public listing of the
// holding. Site rules apply: no fees, no commissions, no view on price.
const D = "Hold pre-IPO or unlisted shares and want to sell before the listing? Tell the desk what you hold. It works with family offices and funds that buy pre-IPO secondaries, and nothing is shared without your consent.";
export const metadata: Metadata = pageMeta({ path: "/sell", title: "Sell your pre-IPO shares", description: D });

const FAQ = `<div class="faq">
<details><summary>Which shares can I sell through the desk?</summary><p>Shares of unlisted Indian companies, ideally profitable and a year or two from listing, held in demat form. Early-investor, angel, family-office and vested ESOP holdings all qualify. The desk looks at each holding before it approaches any buyer.</p></details>
<details><summary>Will my holding be listed on the site?</summary><p>No. The desk takes your holding privately to family offices and funds it already works with. Your name and the company are shared with a buyer only with your consent.</p></details>
<details><summary>How is the price decided?</summary><p>Between you and the buyer. The desk shares what it sees on recent rounds, the company's audited profit and listed peers, and a registered valuer's report usually supports the agreed price.</p></details>
<details><summary>How long does a sale take?</summary><p>Usually two to eight weeks from a buyer agreeing terms: the share purchase agreement, the company's consent or right of first refusal where its articles require it, and the demat transfer. A sale before the company files its draft offer document is simpler.</p></details>
</div>`;

export default function Sell() {
  const faq = faqLd(FAQ);
  return (
    <main>
      <div className="wrap split rd-hero">
        <div>
          <span className="eyebrow">For holders of pre-IPO shares</span>
          <h1 className="tt">Selling before the listing?<span className="tt2">Tell the desk what you hold.</span></h1>
          <p className="lede" style={{ color: "var(--ink2)" }}>Before the Bell works with family offices and funds that buy pre-IPO secondaries: stakes from early investors, angels, employees with vested options and other family offices. Tell the desk the company and roughly what you hold; a banker calls within two working days to say whether it can find a buyer.</p>
          <ul className="ticks">
            <li>Your holding is never listed on the site or shown to anyone without your consent.</li>
            <li>Buyers are family offices and funds the desk already works with.</li>
            <li>The desk handles the paperwork with you: the share purchase agreement, the company's consent and the demat transfer.</li>
          </ul>
          <p className="fine" style={{ marginTop: 14 }}>Read first: <a href="/pre-ipo-investing/sell-pre-ipo-shares">how to sell pre-IPO or unlisted shares before the IPO</a>.</p>
        </div>
        <div className="rd-card fd-card">
          <form className="form" noValidate data-lead="seller" data-ok="Received. A banker from the desk will call within two working days.">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
            <div className="row"><label>Your name<input required name="name" autoComplete="name" /></label><label>Company whose shares you hold<input required name="entity" placeholder="e.g. Acme Industries Ltd" /></label></div>
            <div className="row"><label>Email<input type="email" required name="email" autoComplete="email" /></label><label>Mobile<input type="tel" required name="phone" placeholder="+91" autoComplete="tel" /></label></div>
            <div className="row">
              <label>You are<select name="holder" required defaultValue=""><option value="" disabled>Select</option><option>Early investor or angel</option><option>Employee (ESOP)</option><option>Family office</option><option>Fund</option><option>Promoter or promoter group</option><option>Other</option></select></label>
              <label>Approximate value<select name="size" required defaultValue=""><option value="" disabled>Select</option><option>Under ₹1 Cr</option><option>₹1–5 Cr</option><option>₹5–25 Cr</option><option>Above ₹25 Cr</option></select></label>
            </div>
            <div className="row">
              <label>Shares are held<select name="form" required defaultValue=""><option value="" disabled>Select</option><option>In demat</option><option>On paper (physical)</option><option>Not sure</option></select></label>
              <label>Company's listing plan<select name="listing" required defaultValue=""><option value="" disabled>Select</option><option>DRHP filed</option><option>Within 24 months</option><option>Later or not known</option></select></label>
            </div>
            <label>Anything else (optional)<textarea name="note" rows={2} placeholder="Number of shares, when you bought, any lock-in or right of first refusal you know of" /></label>
            <div><button className="btn primary" type="submit">Tell the desk</button></div>
            <div className="ok" role="status" />
          </form>
        </div>
      </div>
      <section className="wrap sec tight">
        <h2 style={{ fontSize: 24 }}>Questions holders ask</h2>
        <div dangerouslySetInnerHTML={{ __html: FAQ }} />
        <p className="fine" style={{ marginTop: 18 }}>Before the Bell is a deal desk operated by SintraCap Advisors LLP, not a stock exchange or broker. A sale is a private transaction between you and the buyer, subject to the company's articles and applicable law.</p>
      </section>
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />}
    </main>
  );
}
