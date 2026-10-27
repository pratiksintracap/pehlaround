// Guides for promoters and CFOs: what someone searching "how to raise pre-IPO funding" or "SME IPO eligibility"
// needs to know. Written as reference, not marketing; the desk appears only at the end of each. Rules change, so the
// regulatory figures are the ones in force when written, with a pointer to the merchant banker and the regulations.
// Site rules apply: no fees, no commissions, no promise of returns, no description of how the desk scores.

export type Guide = { slug: string; title: string; short: string; desc: string; lede: string; updated: string; body: string; faq: [string, string][] };

const UPDATED = "2026-10-27";

export const GUIDES: Guide[] = [
  {
    slug: "pre-ipo-funding",
    title: "How to raise a pre-IPO round in India",
    short: "Raising a pre-IPO round",
    desc: "A guide for promoters: when to raise a pre-IPO round, primary or secondary, who invests, how a private placement works under the Companies Act, what investors check and how long it takes.",
    lede: "When to raise, from whom, how the private placement works, and what investors look at before they commit.",
    updated: UPDATED,
    body: `
<p>A pre-IPO round is equity raised from private investors in the year or two before a company files for its IPO. Done at the right time, it funds the last stretch of growth before listing, brings in investors whose names help the IPO, and sets a reference price the market can build on. Done late or in a hurry, it fills the cap table with short-term money at a price that leaves the IPO with nowhere to go.</p>

<h2>When to raise it</h2>
<p>The best window is usually twelve to twenty-four months before the draft offer document is filed. By then the company has two or three years of audited numbers that show the trend, but it has not yet appointed a merchant banker or fixed its IPO structure, so there is still room to shape the round: who comes in, at what price, and with which rights. Once a draft red herring prospectus (DRHP) is filed, the pre-IPO round is effectively closed. Investors who buy after that are buying into a known IPO timetable, and the price reflects it.</p>
<p>Raise when the numbers you will list on are already visible. A round raised on next year's projections is priced like a venture round; one raised on this year's audited profit is priced like a pre-IPO round.</p>

<h2>Primary or secondary</h2>
<p><b>A primary round</b> issues new shares. The money goes to the company for capacity, working capital or debt reduction, and every existing shareholder is diluted. It is the cleaner story for the IPO: the investor is funding growth.</p>
<p><b>A secondary</b> is an existing holder selling: a promoter taking some money off the table, an early angel, or an employee with vested options. The company receives nothing. Secondaries are common before an IPO and are not a bad signal in themselves, but investors will ask why the seller is selling now, and a round that is mostly promoter secondary needs a good answer.</p>
<p>Many rounds combine both: a primary for growth and a small secondary that cleans up the cap table before listing.</p>

<h2>Who invests in a pre-IPO round</h2>
<ul>
<li><b>Family offices</b>, the largest and most patient pool. They write ₹1–25 Cr cheques, decide quickly once they trust the source, and usually hold through the listing.</li>
<li><b>Category II AIFs</b> with a pre-IPO or special-situations mandate. Larger and more process-driven; they will want a term sheet and full diligence.</li>
<li><b>Portfolio managers and wealthy individuals</b>, often through a family office or adviser, with tickets from ₹25 lakh.</li>
<li><b>Strategic investors</b> such as a customer or supplier, occasionally, when the business case is clear.</li>
</ul>
<p>Who you take money from shows up in the prospectus. Recognised names before the IPO help the book later; a long list of small unknown holders does not.</p>

<h2>How the private placement works</h2>
<p>A primary round in a private or unlisted public company is done by preferential allotment through a private placement under sections 42 and 62 of the Companies Act, 2013. In outline:</p>
<ul>
<li>A valuation report from a registered valuer supports the issue price.</li>
<li>The board approves the issue, and shareholders pass a special resolution.</li>
<li>The company sends a private placement offer letter (form PAS-4) to identified investors only. It cannot advertise the issue, and an offer can go to at most 200 persons in a financial year, not counting qualified institutional buyers and employees under an ESOP.</li>
<li>Money comes into a separate bank account, and shares are allotted within 60 days of receiving it.</li>
<li>The allotment is reported to the Registrar of Companies (form PAS-3) and the shares are credited in demat form.</li>
</ul>
<p>A secondary needs none of this from the company beyond its consent where the articles require it: the buyer and seller sign a share purchase agreement and the shares move between demat accounts. Your company secretary and lawyer will run the paperwork; what matters for you is to start it early enough that it does not hold up the money.</p>

<h2>What investors check</h2>
<ul>
<li><b>Audited numbers that reconcile</b> with GST returns and bank statements. Differences between books and returns are the most common reason a round stalls.</li>
<li><b>Profit, not only revenue.</b> Pre-IPO investors are paying for earnings the market will value. Show where margin comes from and why it holds.</li>
<li><b>Customer concentration and order book</b>: who buys, how much of revenue the top few customers are, and what is contracted.</li>
<li><b>The price against listed peers.</b> Investors compare your price-to-earnings with listed companies in the same business. If the round is priced at or above them, there is nothing left for the IPO to pay.</li>
<li><b>A path to listing they can date</b>: board or SME platform, which year's numbers the IPO will be based on, and what still has to be done.</li>
<li><b>Governance</b>: related-party dealings, promoter loans, pending litigation and statutory dues. Anything that would have to be explained in a DRHP will be asked about now.</li>
</ul>

<h2>How long it takes</h2>
<p>From the first meeting to money in the bank is typically eight to sixteen weeks for a well-prepared company: a few weeks to put the information together and meet investors, four to eight weeks of diligence, then the documentation and allotment. The single biggest delay is information that is not ready: unaudited months, missing reconciliations, or a cap table that needs cleaning first.</p>

<h2>Mistakes that cost promoters</h2>
<ul>
<li>Pricing the round off the IPO valuation you hope for, so it does not close, or closes with investors who later push to exit.</li>
<li>Taking money from many small holders, each of whom has to be disclosed and tracked to listing.</li>
<li>Giving rights (board seats, vetoes, put options) that have to be unwound before the DRHP, often at a cost.</li>
<li>Raising after the merchant banker is appointed and the IPO is public knowledge, when the round can no longer be shaped.</li>
</ul>
`,
    faq: [
      ["How early before an IPO should a company raise a pre-IPO round?", "Usually twelve to twenty-four months before the draft red herring prospectus is filed. By then two or three years of audited numbers show the trend, and there is still time to choose investors and shape the round before the merchant banker fixes the IPO structure."],
      ["Can a private limited company raise a pre-IPO round?", "Yes. A private company can issue shares by private placement to identified investors under the Companies Act, 2013. It will have to convert to a public limited company before its IPO, and many companies do that conversion around the time of the pre-IPO round."],
      ["How many investors can take part in a private placement?", "An offer can be made to at most 200 persons in a financial year, not counting qualified institutional buyers and employees under an ESOP. The offer must go only to identified persons; the company cannot advertise it."],
      ["Is a promoter secondary a bad signal before an IPO?", "Not in itself. Investors will ask why the promoter is selling and how much, and a small secondary alongside a primary round is common. A round that is mostly promoter selling needs a clear reason."],
    ],
  },
  {
    slug: "sme-ipo-vs-main-board",
    title: "SME IPO or main board: eligibility and how to choose",
    short: "SME IPO or main board",
    desc: "SME IPO and main-board IPO eligibility in India compared: profit and net worth tests, post-issue capital, offer-for-sale limits, use of proceeds, and how promoters choose between NSE Emerge, BSE SME and the main board.",
    lede: "The eligibility tests for each, what changed for SME issues in 2025, and how to decide which board fits your company.",
    updated: UPDATED,
    body: `
<p>An Indian company can list on the main board of the NSE and BSE, or on one of the two SME platforms, NSE Emerge and BSE SME. The SME route is open to smaller companies and moves faster; the main board reaches far deeper pools of capital. The rules for each are set by SEBI's Issue of Capital and Disclosure Requirements (ICDR) Regulations and by the exchanges, and both were tightened for SME issues in 2025. The figures below are those in force when this guide was written; your merchant banker will confirm the current position for your case.</p>

<h2>Main board: the eligibility tests</h2>
<p>Under regulation 6(1) of the ICDR Regulations, a company qualifies for a main-board IPO if, on restated figures for the three preceding full years, it has:</p>
<ul>
<li>net tangible assets of at least ₹3 Cr in each of those years, with no more than half held in monetary assets (unless the issue is entirely an offer for sale);</li>
<li>an average operating profit of at least ₹15 Cr over the three years, with operating profit in each of them; and</li>
<li>a net worth of at least ₹1 Cr in each of the three years.</li>
</ul>
<p>A company that does not meet these can still list through regulation 6(2): the issue must be book-built and at least 75% of the net offer must be allotted to qualified institutional buyers, failing which the money is refunded. That route is how many loss-making or asset-light technology companies have listed.</p>
<p>Promoters must hold at least 20% of the post-issue capital as the minimum promoter contribution, locked in for 18 months (three years where most of the issue funds capital expenditure).</p>

<h2>SME platform: the eligibility tests</h2>
<ul>
<li><b>Size:</b> SME issues are for companies with a post-issue paid-up capital of up to ₹25 Cr.</li>
<li><b>Profit:</b> since 2025, an operating profit (EBITDA) of at least ₹1 Cr in two of the three preceding financial years.</li>
<li><b>Offer for sale:</b> selling shareholders together can sell at most 20% of the issue size, and each can sell at most half of their own holding.</li>
<li><b>Use of proceeds:</b> general corporate purposes are capped at 15% of the issue or ₹10 Cr, whichever is lower, and the money cannot be used to repay loans from promoters, the promoter group or related parties.</li>
<li><b>Promoter shares above the minimum contribution</b> are released in stages, half after one year and half after two.</li>
<li><b>The draft offer document</b> is open to public comments for 21 days before the exchange decides.</li>
</ul>
<p>The exchanges add their own conditions on track record, net worth and the company's history; NSE Emerge and BSE SME differ in the detail, which is one reason to choose the platform with your merchant banker early.</p>

<h2>How to choose</h2>
<div class="cmpwrap"><table class="cmp plain"><thead><tr><th></th><th>SME platform</th><th>Main board</th></tr></thead><tbody>
<tr><th scope="row">Typical issue size</th><td>₹10–100 Cr</td><td>₹100 Cr and above</td></tr>
<tr><th scope="row">Who buys in the IPO</th><td>HNIs and a smaller institutional book; minimum application of two lots</td><td>Mutual funds, insurers, FPIs, HNIs and retail</td></tr>
<tr><th scope="row">Liquidity after listing</th><td>Trades in lots; thinner, with a market maker for three years</td><td>Deeper, with analyst coverage once the company is large enough</td></tr>
<tr><th scope="row">Regulator of the offer document</th><td>The exchange</td><td>SEBI</td></tr>
<tr><th scope="row">Valuation</th><td>Usually lower multiples, priced off a smaller buyer base</td><td>Priced against listed peers with institutional demand</td></tr>
</tbody></table></div>
<p>A company with ₹15 Cr of average operating profit or more usually does better to wait and list on the main board: the multiple is higher, the investor base is deeper, and it avoids migrating later. A company well below that, with a clear use for ₹20–50 Cr now, may be better served by an SME listing, followed by migration to the main board once it qualifies.</p>
<p>Either way, the year or two before filing is when a pre-IPO round helps most: it funds the growth that lifts the company into the next bracket, and the investors who come in early become part of the IPO story.</p>
`,
    faq: [
      ["What is the minimum profit for a main-board IPO in India?", "Under regulation 6(1) of SEBI's ICDR Regulations, an average operating profit of at least ₹15 Cr over the three preceding years, with operating profit in each, along with net tangible assets of ₹3 Cr and a net worth of ₹1 Cr in each year. Companies that do not meet this can list under regulation 6(2) if at least 75% of the net offer goes to qualified institutional buyers."],
      ["What changed in the SME IPO rules in 2025?", "SEBI added a profit test (operating profit of at least ₹1 Cr in two of the three preceding years), capped the offer for sale at 20% of the issue with each seller limited to half their holding, capped general corporate purposes at 15% of the issue or ₹10 Cr, barred using proceeds to repay promoter and related-party loans, and opened the draft offer document to 21 days of public comment."],
      ["Can an SME-listed company move to the main board?", "Yes. Once it meets the main-board eligibility and the exchange's migration conditions, an SME-listed company can migrate, subject to shareholder approval. Many companies plan an SME listing with migration in mind."],
    ],
  },
  {
    slug: "pre-ipo-valuation",
    title: "How investors value a company before its IPO",
    short: "Pre-IPO valuation",
    desc: "How family offices and funds value an unlisted company in a pre-IPO round: listed-peer multiples, the discount for illiquidity and time to listing, growth, quality of earnings, and what promoters can do to support the price.",
    lede: "The multiple investors start from, the discounts they apply, and what moves the price in your favour.",
    updated: UPDATED,
    body: `
<p>Every promoter has a number in mind. Investors arrive at theirs differently: they start from what the market pays today for similar listed companies, then take off what it costs them to wait and to carry the risk that the listing slips. The gap between those two numbers is where most rounds stall.</p>

<h2>Where the number starts: listed peers</h2>
<p>Investors pick four to eight listed companies in the same business and look at what the market pays for them: price-to-earnings on trailing and next-year profit, EV/EBITDA for capital-heavy businesses, and price-to-book for lenders. The median of that set is the starting point, adjusted for where your company sits within it on growth, margins, return on capital and balance-sheet strength.</p>
<p>Choose the peers carefully and be ready to defend them. A specialty-chemicals company compared with the highest-rated names in its sector will hear that it is not one of them; compared with the whole sector, it may look cheap.</p>

<h2>The discounts</h2>
<ul>
<li><b>Time to listing.</b> An investor who pays today and can sell only after listing and the six-month lock-in is waiting two or three years. That wait has a cost, and the further away and less certain the IPO, the larger it is.</li>
<li><b>Illiquidity.</b> Until listing there is no market for the shares. If the IPO slips, the investor needs another exit.</li>
<li><b>Size and concentration.</b> Smaller companies, and those dependent on a few customers or one promoter, trade at lower multiples once listed, and investors price that in now.</li>
<li><b>Quality of earnings.</b> Profit that depends on one-off income, aggressive capitalisation, or related-party transactions is discounted or excluded.</li>
</ul>
<p>Put together, pre-IPO rounds in profitable Indian companies commonly price at a meaningful discount to where comparable listed peers trade. That discount is the investor's return for taking the wait and the risk; a round with none left has no reason to close.</p>

<h2>What supports the price</h2>
<ul>
<li><b>Audited numbers for the year you are pricing on.</b> A round priced on audited profit gets a better multiple than one priced on projections.</li>
<li><b>A dated path to listing</b>: the board you will list on, the year's numbers the IPO will use, and the steps already done (conversion to a public company, independent directors, demat shares).</li>
<li><b>Clean governance</b>: no unexplained related-party flows, statutory dues paid, litigation disclosed.</li>
<li><b>An order book or contracted revenue</b> that makes next year's profit more than a projection.</li>
<li><b>A credible lead investor</b> whose commitment others can follow.</li>
</ul>

<h2>Price is not the only term</h2>
<p>Investors will trade price for protection: a valuation adjustment if the IPO does not happen by a date, an exit right, or a ratchet tied to next year's profit. These rights usually have to fall away before the DRHP is filed. A slightly lower clean price is often worth more to a promoter than a higher price carrying rights that must be unwound later.</p>
`,
    faq: [
      ["How is a pre-IPO valuation calculated?", "Investors usually start from the price-to-earnings or EV/EBITDA multiples of listed peers in the same business, adjust for the company's growth, margins and balance sheet, and then apply a discount for the time to listing, the lack of liquidity before it, and the risk that the IPO slips."],
      ["Why do pre-IPO rounds price below the IPO?", "Because the investor waits longer and carries more risk: there is no market for the shares before listing, the IPO date can move, and pre-IPO shares are usually locked in for six months after listing. The discount is the investor's return for that."],
      ["Does a registered valuer's report set the price?", "No. A private placement needs a valuation report from a registered valuer to support the issue price, but the price itself is agreed between the company and investors. The report shows the price is fair under the Companies Act; it does not make investors pay it."],
    ],
  },
  {
    slug: "ipo-readiness",
    title: "IPO readiness: what to fix in the two years before you file",
    short: "Getting IPO-ready",
    desc: "An IPO readiness guide for Indian promoters and CFOs: audits, restated financials, governance and independent directors, conversion to a public company, demat shares, related-party clean-up and the documents a merchant banker will ask for.",
    lede: "The work that takes longest is the work nobody notices until the merchant banker asks for it.",
    updated: UPDATED,
    body: `
<p>Most IPO delays are not about the market. They come from work that should have started two years earlier: accounts that do not reconcile, related-party arrangements nobody wrote down, a cap table with gaps, or a board that does not yet meet listing standards. Starting early costs little; starting late moves the IPO by a year.</p>

<h2>Financials</h2>
<ul>
<li><b>Audits on time, by an auditor who can sign for an IPO.</b> Offer documents carry restated financial statements, which must be audited or reviewed by an auditor holding a valid peer-review certificate. Changing auditors in the IPO year raises questions; change early if you must.</li>
<li><b>Reconcile the books with GST returns, income-tax filings and bank statements</b> for every year the IPO will show. Investors and the merchant banker will.</li>
<li><b>Ind AS.</b> Companies above the thresholds must already report under Ind AS; others should plan the conversion so the restated years are comparable.</li>
<li><b>Monthly closes.</b> A company that closes its books in ten days each month can answer diligence questions quickly; one that closes quarterly cannot.</li>
</ul>

<h2>Corporate structure and shares</h2>
<ul>
<li><b>Convert to a public limited company</b> well before filing. It requires shareholder approval and amended articles, and investors in a pre-IPO round often expect it.</li>
<li><b>All shares in demat form</b>, with an ISIN for each class. Unlisted public companies must already issue and transfer shares only in demat form.</li>
<li><b>A clean cap table</b>: every allotment and transfer since incorporation documented, with forms filed at the Registrar of Companies. Missing filings from early years are a common and slow fix.</li>
<li><b>Group structure</b>: businesses the promoter runs alongside the company that compete with it or trade with it will have to be explained, merged or separated.</li>
</ul>

<h2>Governance</h2>
<ul>
<li><b>A board that meets listing standards</b>: independent directors (at least a third of the board, or half where the chair is an executive or promoter), at least one woman director, and the audit, nomination and remuneration, and stakeholders' relationship committees.</li>
<li><b>A related-party policy</b>, with every transaction with promoter entities on arm's-length terms and approved by the audit committee.</li>
<li><b>Promoter loans and guarantees</b> mapped and, where possible, reduced; proceeds of an SME issue cannot be used to repay them.</li>
<li><b>Litigation and statutory dues</b> listed and resolved where possible. Every pending matter above a threshold goes into the offer document.</li>
</ul>

<h2>People and documents</h2>
<ul>
<li>A CFO and company secretary who have been through diligence, or will be supported by people who have.</li>
<li>Contracts with your largest customers and suppliers, licences and approvals, title documents for property, and intellectual-property filings, all in one place.</li>
<li>An ESOP scheme, if you want one, set up before the IPO under the SEBI rules that will apply after listing.</li>
</ul>

<h2>Where a pre-IPO round fits</h2>
<p>Readiness and the pre-IPO round reinforce each other. Investors in the round run the same checks a merchant banker will, so the issues surface while there is time to fix them, and the company enters the IPO process with its numbers already tested.</p>
`,
    faq: [
      ["How long does it take to get a company IPO-ready?", "Usually eighteen to twenty-four months for a well-run private company: enough time for audits by a peer-reviewed auditor, conversion to a public company, board and committee changes, cap-table and related-party clean-up, and two or three years of numbers in the shape the offer document needs."],
      ["Does a company have to be a public limited company before its IPO?", "Yes. A private limited company must convert to a public limited company before it can offer shares to the public. Most do so a year or more before filing."],
      ["What does a merchant banker check first?", "Eligibility on restated financials, the cap table and history of allotments, related-party transactions, litigation and statutory dues, and whether the board and committees meet listing requirements. Problems in any of these move the filing date."],
    ],
  },
  {
    slug: "primary-vs-secondary",
    title: "Primary round or secondary sale: a promoter's guide",
    short: "Primary or secondary",
    desc: "Primary raise or secondary sale before an IPO: how each affects dilution, control, tax and the IPO story, how investors read a promoter secondary, and how to combine the two.",
    lede: "Where the money goes, what it does to your stake, and how investors read each.",
    updated: UPDATED,
    body: `
<p>Before an IPO, a promoter can bring in investors in two ways: issue new shares (a primary) or sell existing ones (a secondary). The choice decides where the money goes, how much of the company the promoter keeps, and how the round reads when the IPO comes.</p>

<h2>The difference in one line</h2>
<p>In a primary, the company receives the money and everyone is diluted. In a secondary, the seller receives the money and only the seller's stake falls.</p>

<h2>When a primary makes sense</h2>
<ul>
<li>The company has a use for the capital that lifts next year's profit: capacity, working capital for orders in hand, or paying down expensive debt.</li>
<li>The promoter wants to keep the holding above the level they want at listing, after IPO dilution and the 20% minimum promoter contribution.</li>
<li>The IPO story will be about growth, and the round funds it.</li>
</ul>

<h2>When a secondary makes sense</h2>
<ul>
<li>An early investor or angel wants to exit before listing, and a cleaner cap table helps the IPO.</li>
<li>The promoter has concentrated personal wealth in the company and wants some liquidity, in a size investors will see as prudent rather than an exit.</li>
<li>The company does not need capital, and issuing shares would only dilute.</li>
</ul>

<h2>How investors read a secondary</h2>
<p>A secondary invites one question: why is this holder selling now? An early investor whose fund is closing has a clear answer. A promoter selling a small part of a large stake, alongside a primary round, usually does too. A round that is mostly promoter selling at a full price needs the strongest answer, because the seller knows the business better than any buyer.</p>

<h2>Tax and paperwork, in outline</h2>
<p>A primary is a private placement under the Companies Act, with board and shareholder approvals, an offer letter, a separate bank account and filings with the Registrar of Companies. A secondary is a share purchase agreement between buyer and seller, with the shares moving between demat accounts. The seller in a secondary pays capital-gains tax on the sale; in a primary, nobody is selling. Take your CA's advice on your own position.</p>

<h2>Combining the two</h2>
<p>Many pre-IPO rounds are a primary with a small secondary attached: the company raises growth capital, and an early holder or the promoter sells a slice at the same price. Investors get a larger allocation, the cap table is cleaner at listing, and the story stays about growth.</p>
`,
    faq: [
      ["Does a secondary sale dilute other shareholders?", "No. In a secondary, existing shares change hands, so only the seller's stake falls. In a primary round, new shares are issued and every existing shareholder is diluted."],
      ["Can a promoter sell shares before an IPO?", "Yes, by a secondary sale to private investors, subject to the company's articles and any shareholder agreements. Investors will ask why the promoter is selling and how much; a small secondary alongside a primary raise is common."],
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
