// Guides for investors, under /pre-ipo-investing/<slug>: what someone searching "pre-IPO lock-in" or "how to sell
// unlisted shares" needs to know. Reference first; the desk appears only at the end. Regulatory and tax figures are
// the ones in force when written, with a pointer to the offer document and the investor's own CA, since rules change.
// Site rules apply: no fees, no commissions, no promise of returns, no view on any price.

import type { Guide } from "@/lib/promoter-guides";

const UPDATED = "2026-11-03";

export const INVESTOR_GUIDES: Guide[] = [
  {
    slug: "lock-in-after-ipo",
    title: "Lock-in of pre-IPO shares after listing: main board and SME",
    short: "Lock-in after listing",
    desc: "How long pre-IPO shares are locked in after an Indian IPO: non-promoter and promoter lock-ins on the main board and SME platforms, anchor lock-in, what the clock runs from, and where to check.",
    lede: "How long pre-IPO shares are locked in after an Indian IPO, what the clock runs from, and where to check for your own holding.",
    updated: UPDATED,
    body: `
<p>Shares you hold before a company's IPO cannot be sold the day it lists. SEBI's Issue of Capital and Disclosure Requirements (ICDR) Regulations lock in the pre-issue capital for a period after listing, so that early holders do not all sell into the first days of trading. The lock-in is the most important date for a pre-IPO investor: it, not the listing date, is when you can first sell.</p>

<h2>Main board: non-promoter shareholders</h2>
<p>On the main board, shares held before the IPO by anyone other than the promoters are generally locked in for <b>six months from the date of allotment in the IPO</b>. This covers family offices, individuals, and most funds that bought in a pre-IPO round or a secondary.</p>
<p>There are narrow exemptions, for example for some shares held by registered venture capital funds and Category I or II AIFs for the required period, and for shares sold in the IPO's offer for sale. Do not assume an exemption applies to you; the offer document lists who is exempt.</p>

<h2>Main board: promoters</h2>
<p>Promoters must keep a minimum contribution, broadly 20% of the post-issue capital, locked in for eighteen months (three years where the IPO money is mostly for capital expenditure). Promoter holding above that minimum is locked in for six months (one year in the capital-expenditure case). This matters to you as a pre-IPO investor because it tells you how much stock can come to market, and when.</p>

<h2>SME platforms</h2>
<p>The SME rules are stricter. The entire pre-issue capital held by persons other than the promoters is generally locked in for <b>one year from allotment</b>, and the promoters' minimum contribution for three years, with promoter holding above the minimum released in stages. If you are buying into a company that plans an SME listing, plan on a one-year hold after listing at the least.</p>

<h2>Anchor investors</h2>
<p>Shares allotted to anchor investors in the IPO itself carry their own lock-in: half for 30 days and half for 90 days from allotment. This is separate from the pre-IPO lock-in and applies only to shares bought in the anchor book.</p>

<h2>What the clock runs from</h2>
<ul>
<li>The lock-in runs from the <b>date of allotment in the IPO</b>, which is a day or two before listing, not from the day you bought.</li>
<li>Your <b>holding period for tax</b>, by contrast, runs from the day you bought. A share bought eighteen months before listing and sold the day the lock-in ends has been held for two years for tax.</li>
<li>Shares under lock-in sit in your demat account marked as locked; the depository releases them automatically when the period ends.</li>
</ul>

<h2>Where to check</h2>
<p>The draft red herring prospectus (DRHP), and later the red herring prospectus, has a section on lock-in that lists every class of holder and the period that applies. Read it as soon as it is filed: the rules above are the general case, and the offer document is what binds. Lock-in rules have changed several times in recent years, so check the version in force for your IPO.</p>
`,
    faq: [
      ["How long are pre-IPO shares locked in after listing in India?", "On the main board, shares held before the IPO by non-promoter shareholders are generally locked in for six months from the date of allotment in the IPO. On SME platforms the general rule is one year. The offer document states the exact lock-in for each class of holder."],
      ["Does the lock-in start from the day I bought the shares?", "No. It runs from the date of allotment in the IPO. Your holding period for tax, however, runs from the day you bought."],
      ["Can I pledge or transfer shares during the lock-in?", "Locked-in shares cannot be sold on the exchange. Limited transfers, for example within a promoter group or on inheritance, are allowed with the lock-in continuing for the new holder; the offer document and the depository rules set out what is permitted."],
      ["Is the anchor lock-in the same as the pre-IPO lock-in?", "No. Anchor shares are bought in the IPO and are locked in half for 30 days and half for 90 days. Pre-IPO shares carry the longer pre-issue lock-in."],
    ],
  },
  {
    slug: "tax-on-pre-ipo-shares",
    title: "How pre-IPO and unlisted shares are taxed in India",
    short: "Tax on pre-IPO shares",
    desc: "Tax on unlisted and pre-IPO shares in India: long-term and short-term gains before and after listing, the holding period, buying below fair value, stamp duty and TDS for non-residents.",
    lede: "Capital gains before and after listing, how the holding period counts, and the rules that catch investors out.",
    updated: UPDATED,
    body: `
<p>A pre-IPO share changes tax treatment when the company lists. Before listing it is an unlisted share; after listing, sold on the exchange, it is a listed share. What you pay depends on when and how you sell, and on how long you have held it. The figures below are those in force for transfers from 23 July 2024 under the Income-tax Act; confirm with your CA before you act, because they change with Budgets.</p>

<h2>Selling while the company is still unlisted</h2>
<ul>
<li><b>Held more than 24 months:</b> long-term capital gain, taxed at 12.5% without indexation.</li>
<li><b>Held 24 months or less:</b> short-term capital gain, taxed at your slab rate.</li>
</ul>
<p>The buyer and seller agree the price privately, so it should be supported by a valuation; see the fair-value rule below.</p>

<h2>Selling after listing, on the exchange</h2>
<ul>
<li><b>Held more than 12 months:</b> long-term gain taxed at 12.5% on gains above the annual exemption of ₹1.25 lakh, since securities transaction tax is paid on the sale.</li>
<li><b>Held 12 months or less:</b> short-term gain taxed at 20%.</li>
</ul>
<p>The holding period runs from the day you bought the unlisted share, not from the listing. Because the lock-in usually ends six months to a year after listing, most pre-IPO holdings are already long-term by the time they can be sold.</p>
<p>Listed shares sold off-market, outside the exchange, do not get the ₹1.25 lakh exemption, because no securities transaction tax is paid.</p>

<h2>Buying below fair value</h2>
<p>If you buy unlisted shares for less than their fair market value, the shortfall can be taxed in your hands as income when it exceeds ₹50,000. Fair market value for unlisted shares is set by the valuation rules under the Act. In a primary allotment the company's registered-valuer report supports the price; in a secondary, ask for a valuation that supports what you are paying.</p>

<h2>Bonus and split shares</h2>
<p>Companies often issue bonus shares or split their shares before an IPO. Bonus shares have a cost of nil and their own holding period from the date of allotment; on a split, the original cost and date carry across to the new shares. Keep the corporate-action records: you will need them when you sell.</p>

<h2>Stamp duty and other costs</h2>
<p>A transfer of shares in demat form attracts stamp duty, collected through the depository, at 0.015% of the consideration. A fresh issue by the company attracts stamp duty on the allotment, paid by the company. Brokerage or arranger costs on a secondary are added to cost or deducted from the sale price for computing the gain.</p>

<h2>Non-residents</h2>
<p>When a non-resident sells, the buyer must deduct tax at source on the gain at the applicable rate, and the non-resident files a return in India. Treaty relief may apply; take advice in both countries.</p>
`,
    faq: [
      ["How is the sale of unlisted shares taxed in India?", "For transfers from 23 July 2024, unlisted shares held for more than 24 months give long-term gains taxed at 12.5% without indexation; shorter holdings are taxed at your slab rate. Confirm the current rates with your CA."],
      ["Does the holding period restart when the company lists?", "No. It runs from the day you acquired the shares. Time held before the listing counts towards the 12 months needed for long-term treatment of listed shares."],
      ["Is there tax if I buy pre-IPO shares at a discount?", "If you pay less than the fair market value worked out under the valuation rules, the difference can be taxed as your income when it exceeds ₹50,000. A valuation supporting the price protects you."],
      ["Do I pay securities transaction tax on a pre-IPO purchase?", "No. A private placement or an off-market transfer of unlisted shares does not attract securities transaction tax. Stamp duty of 0.015% applies on a demat transfer."],
    ],
  },
  {
    slug: "sme-ipo-anchor-investing",
    title: "SME IPO anchor and pre-IPO allocations: how investors get in",
    short: "SME IPO allocations",
    desc: "How investors get an allocation in an Indian SME IPO: the anchor book, the institutional and non-institutional portions, pre-IPO placements, lock-ins, and what to read in the offer document.",
    lede: "The anchor book, the other portions of an SME issue, and placements before the IPO: who can apply for what, and what to read first.",
    updated: UPDATED,
    body: `
<p>SME IPOs list on BSE SME or NSE Emerge. They are small, often ₹20 to ₹100 crore, and the allocation is decided as much before the issue opens as during it. There are three ways in, and they suit different investors.</p>

<h2>1. A placement before the IPO</h2>
<p>In the months before it files, a company may raise a pre-IPO round by private placement, or a shareholder may sell some shares. This is the only route where the price is negotiated rather than set by the issue. Pre-IPO shares are locked in after listing (generally one year on SME platforms) and any placement after the draft offer document is filed must be disclosed to the exchange.</p>

<h2>2. The anchor book</h2>
<p>Up to 60% of the institutional portion can be allotted to anchor investors a day before the issue opens, at a price within the band. Anchor investors must be qualified institutional buyers: mutual funds, insurers, banks, registered AIFs and certain foreign portfolio investors, among others. Family offices usually take part through an AIF or other eligible vehicle rather than in their own name.</p>
<p>Anchor shares are locked in, half for 30 days and half for 90 days after allotment. The names of anchor investors are published before the issue opens, which is why issuers value a recognised anchor.</p>

<h2>3. The issue itself</h2>
<p>The rest of the issue is split between institutional buyers, non-institutional investors (applications above the individual limit, where most family offices and HNIs apply in their own name) and individual investors. Allotment in an oversubscribed SME issue is by lot or proportionate, so the size of your application does not guarantee the size of your allotment.</p>

<h2>What to read before you apply</h2>
<ul>
<li><b>The draft red herring prospectus</b>: restated financials, the objects of the issue, related-party transactions and the risk factors.</li>
<li><b>The lead manager's track record</b> on earlier SME issues, and the market maker appointed for the stock.</li>
<li><b>The price against listed peers</b>, on trailing earnings and on the earnings the issue is priced on.</li>
<li><b>How much of the issue is an offer for sale</b>: money going to selling shareholders rather than to the company.</li>
<li><b>Promoter holding after the issue</b>, and what is locked in.</li>
</ul>

<h2>Liquidity after listing</h2>
<p>SME stocks trade in lots and can be thinly traded; the market maker provides two-way quotes for a set period. Plan to hold, and size the position for an exit that may take time. A company can migrate to the main board once it meets the eligibility conditions, which usually improves liquidity.</p>
`,
    faq: [
      ["Can a family office be an anchor investor in an SME IPO?", "Anchor investors must be qualified institutional buyers. A family office usually takes part through an AIF or other eligible vehicle, or applies in the non-institutional portion of the issue in its own name."],
      ["How long are anchor shares locked in?", "Half for 30 days and half for 90 days from the date of allotment."],
      ["Is a pre-IPO placement in an SME company locked in?", "Yes. Pre-issue capital held by non-promoters is generally locked in for one year after listing on SME platforms. The offer document states the exact terms."],
      ["Can an SME company move to the main board?", "Yes, once it meets the main board's eligibility conditions, including size and track record after listing, and with shareholder approval. Migration usually brings wider participation and better liquidity."],
    ],
  },
  {
    slug: "pre-ipo-for-nri",
    title: "Pre-IPO investing for NRIs: the FEMA route, demat and tax",
    short: "Pre-IPO for NRIs",
    desc: "How non-resident Indians can invest in Indian pre-IPO and unlisted shares: repatriable and non-repatriable routes under FEMA, pricing rules, filings, demat, lock-in and tax on exit.",
    lede: "Repatriable or non-repatriable, the pricing and reporting rules under FEMA, and what happens on exit.",
    updated: UPDATED,
    body: `
<p>Non-resident Indians can buy shares in unlisted Indian companies, including in pre-IPO rounds and secondaries. The investment is governed by the Foreign Exchange Management (Non-debt Instruments) Rules, 2019, and how you invest decides whether you can take the money out of India freely when you sell.</p>

<h2>Two routes</h2>
<p><b>Repatriable (foreign direct investment).</b> You invest from your NRE account or by remittance from abroad. The investment counts as foreign investment in the company, so the sector's limits and conditions apply: most sectors allow it automatically, some need government approval, and a few are closed. Sale proceeds, after tax, can be repatriated.</p>
<p><b>Non-repatriable.</b> You invest from your NRO account. It is treated like a resident investment: sectoral caps for foreign investment do not apply, and the company files less. Sale proceeds go back to your NRO account, from which repatriation is limited to the annual NRO allowance.</p>

<h2>Pricing and reporting</h2>
<ul>
<li>On the repatriable route, the price for a fresh issue or a purchase from a resident must not be below the fair value worked out by an internationally accepted method, certified by a chartered accountant, merchant banker or registered valuer.</li>
<li>The company reports a fresh issue to a non-resident on form FC-GPR within 30 days of allotment.</li>
<li>A secondary purchase from a resident is reported on form FC-TRS, usually by the resident party, within 60 days of the transfer or the receipt of funds.</li>
<li>The company's sector matters: defence, insurance, broadcasting and some financial services carry caps or approval requirements. Ask for the company's foreign-investment position before you commit.</li>
</ul>

<h2>Demat and the IPO</h2>
<p>You will need a PAN, a demat account in your NRI status (repatriable or not, matching the route), and a bank account to match. Shares are credited to that demat account. After listing, the shares carry the same pre-IPO lock-in as for residents, and when you sell on the exchange, the listed-equity rules and portfolio investment reporting apply through your bank.</p>

<h2>Tax on exit</h2>
<p>Capital gains are taxed in India at the same rates as for residents, but the buyer, or your broker after listing, deducts tax at source on the gain. You file an Indian return to settle the final tax and claim any refund. Your country of residence may tax the gain too, with credit under the tax treaty. Take advice in both countries before you invest, not when you sell.</p>
`,
    faq: [
      ["Can an NRI invest in a pre-IPO round in India?", "Yes. An NRI can subscribe to a private placement or buy existing shares of an unlisted Indian company, on a repatriable basis (as foreign investment, subject to sectoral rules) or a non-repatriable basis (from an NRO account)."],
      ["Which forms are filed when an NRI buys unlisted shares?", "For a fresh issue the company files FC-GPR within 30 days of allotment. For a purchase from a resident on a repatriable basis, FC-TRS is filed within 60 days."],
      ["Are pre-IPO shares bought by an NRI locked in after the IPO?", "Yes, on the same terms as for resident shareholders. The offer document states the lock-in for each class of holder."],
      ["Is tax deducted when an NRI sells pre-IPO shares?", "Yes. The buyer, or the broker after listing, deducts tax at source on the capital gain. The NRI files an Indian return to settle the final liability."],
    ],
  },
  {
    slug: "sell-pre-ipo-shares",
    title: "How to sell pre-IPO or unlisted shares before the IPO",
    short: "Selling before the IPO",
    desc: "How to sell unlisted or pre-IPO shares in India before the company lists: finding a buyer, price and valuation, transfer restrictions and ROFR, the share purchase agreement, demat transfer, tax and timing around the DRHP.",
    lede: "Finding a buyer, agreeing a price, the company's consent, the transfer itself, and the timing rules around an IPO filing.",
    updated: UPDATED,
    body: `
<p>Early investors, angels, employees with vested options and family offices often want to sell some or all of a holding before the company lists. There is no exchange for unlisted shares, so the sale is a private transaction between a buyer and a seller. Done carefully it takes a few weeks; done carelessly it can stall at the company's door or leave a tax problem behind.</p>

<h2>1. Check what you can sell</h2>
<ul>
<li><b>Are the shares in demat?</b> Most unlisted companies must now issue shares only in demat form. If yours are on paper, convert them first through a depository participant and the company's registrar.</li>
<li><b>What do the articles and any shareholders' agreement say?</b> Many companies give existing shareholders or the promoters a right of first refusal (ROFR), require board consent, or restrict transfers to competitors. In a private limited company, transfers are restricted by law and by the articles.</li>
<li><b>Are the shares free of any pledge or lock-in</b> from an earlier agreement?</li>
<li><b>For ESOP shares</b>, the plan and your exercise terms set out when you can sell and whether the company has a buyback window.</li>
</ul>

<h2>2. Find a buyer and agree a price</h2>
<p>Buyers for pre-IPO secondaries are mostly family offices, funds with an unlisted mandate, and the company's own promoters. The price is negotiated, usually against the last funding round, the company's latest audited profit and the valuation of listed peers, with a discount for the wait to listing and the lock-in after it. A valuation report from a registered valuer or merchant banker supports the price for both sides, including against the fair-value tax rules.</p>

<h2>3. Paperwork and transfer</h2>
<ul>
<li>A <b>share purchase agreement</b> setting out price, number of shares, representations on title and conditions.</li>
<li>The <b>company's consent or waiver</b> where the articles require it, and evidence that any ROFR was offered and declined.</li>
<li>Payment, then an <b>off-market transfer</b> from your demat account to the buyer's through a delivery instruction, with stamp duty of 0.015% collected by the depository.</li>
<li>If the buyer is a non-resident, the foreign-investment pricing and reporting rules apply (form FC-TRS).</li>
</ul>

<h2>4. Timing around the IPO</h2>
<p>Once a company files its draft red herring prospectus, any transfer of its shares must be reported to the stock exchanges within 24 hours, and the merchant banker will be watching the cap table. Shares a shareholder wants to sell in the IPO's offer for sale generally must have been held for at least a year before the DRHP is filed. If you want to sell before the IPO, the cleanest window is before the filing.</p>

<h2>5. Tax</h2>
<p>A sale of unlisted shares held for more than 24 months is a long-term gain, taxed at 12.5% without indexation for transfers from 23 July 2024; shorter holdings are taxed at your slab rate. Keep the purchase records, the valuation and the agreement for your return.</p>
`,
    faq: [
      ["Can I sell unlisted shares before the IPO?", "Yes, by a private sale to a buyer, subject to the company's articles (for example a right of first refusal or board consent) and any shareholders' agreement. The shares move by an off-market demat transfer."],
      ["How is the price of unlisted shares decided?", "By negotiation, usually against the last funding round, the company's audited profit and listed peers, with a discount for the time to listing and the lock-in after it. A registered valuer's report supports the price."],
      ["Can I sell my shares after the DRHP is filed?", "Transfers after the draft offer document is filed are allowed but must be reported to the stock exchanges within 24 hours, and the merchant banker will want to know. Selling before the filing is simpler."],
      ["How long does a secondary sale of unlisted shares take?", "Typically two to eight weeks: finding a buyer, agreeing the price and documents, the company's consent or ROFR process, and the demat transfer."],
    ],
  },
];

export const investorGuideBySlug = (slug: string) => INVESTOR_GUIDES.find((g) => g.slug === slug);
