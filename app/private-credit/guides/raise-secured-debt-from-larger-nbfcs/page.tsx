import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE, creditGuide } from "@/lib/credit";
import { GuideArticle } from "@/components/credit/CreditBits";
import { SellDownDiagram } from "@/components/credit/diagrams";

const slug = "raise-secured-debt-from-larger-nbfcs";
const g = creditGuide(slug);
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/guides/${slug}`, title: g.title, description: g.description, type: "article" });

export default function Page() {
  return (
    <GuideArticle
      slug={slug}
      lede="NBFC-to-NBFC lending lets a smaller NBFC borrow against security from larger NBFCs. This guide explains how a secured raise works, how one proposal can reach several lenders at once, and what parity means for the borrower."
    >
      <h2>What NBFC-to-NBFC lending is</h2>
      <p>
        For most NBFCs, borrowed money is what funds the loan book. Raising debt is therefore a recurring part of
        running the business rather than a one-off event, and the treasury team is never far from its next raise.
      </p>
      <p>
        In NBFC-to-NBFC lending, the lender is itself an NBFC. A larger NBFC lends to a smaller one, and the
        smaller NBFC uses that funding to keep lending to its own customers. Both sides run lending businesses,
        so the lender reads the borrower&apos;s book the way it reads its own: by segment, by quality and by the
        security that stands behind it.
      </p>

      <h2>Why the debt is secured</h2>
      <p>
        In secured lending, the borrower offers security against the loan. For an NBFC borrower, that security
        often comes from the business itself, such as a pool of the loans it has made. The security is central
        to the raise: it is one of the first things a lender looks at in its diligence, and it is what gives the
        lender comfort beyond the borrower&apos;s own balance sheet.
      </p>
      <p>
        When a raise is shared by several lenders, the security matters in a second way. Each lender needs to know
        that its position is backed on the same footing as everyone else&apos;s. That is what parity, covered
        below, is for.
      </p>

      <h2>Raising from one lender at a time</h2>
      <p>
        Without a platform, a raise is placed one lender at a time. The borrower sends its company information to
        the first lender, answers its questions, waits for a decision, and then repeats the exercise with the next.
        Each lender asks for the same material in a slightly different shape. When the next drawdown comes round,
        much of the work starts again.
      </p>
      <p>
        That process is slow for the borrower and repetitive for lenders, and it makes funding harder to plan. A
        treasury team cannot easily line up its next raise when each one depends on a fresh round of conversations.
      </p>

      <h2>One proposal, sold down across several lenders</h2>
      <p>
        The alternative is to bring one funding proposal and let it be sold down across several lenders. The
        proposal sets out the amount the borrower needs and the security behind it. Instead of being placed in a
        single piece, the raise is split into parts, and each lender that takes part holds one of them.
      </p>
      <figure>
        <SellDownDiagram />
        <figcaption>An illustration of one raise split across lenders. The labels are generic, not real lenders.</figcaption>
      </figure>
      <p>On the debt desk, a raise moves through the same steps each time:</p>
      <ol className="points">
        <li><strong>Funding proposal.</strong> The borrowing NBFC brings the amount it needs and the security behind it.</li>
        <li><strong>Level 1 diligence.</strong> The platform screens the borrower before the raise is shared with any lender.</li>
        <li><strong>Matching.</strong> The raise is matched to lenders on their thesis, rate band and risk appetite, and shared only with them.</li>
        <li><strong>Level 2 diligence.</strong> Each matched lender runs its own diligence on the same files.</li>
        <li><strong>Sell-down at parity.</strong> The raise is split across the lenders who take part.</li>
      </ol>

      <h2>What parity means</h2>
      <p>
        Parity means every lender in a raise gets the same security, the same terms and the same rate. No lender
        sits ahead of another inside the same raise.
      </p>
      <p>
        For the borrower, parity keeps a multi-lender raise simple. There is one set of terms for the raise rather
        than a different arrangement with each lender, and every lender is being asked the same question. For
        lenders, parity is what makes it reasonable to take part alongside others they cannot see: each lender sees
        the total raise and how much of it is filled, and only its own position within it.
      </p>

      <h2>Where a platform fits</h2>
      <p>
        The Before the Bell debt desk arranges secured NBFC-to-NBFC lending in India. It puts the borrower, the matched
        lenders and the diligence between them in one place, so each step picks up from the last.
      </p>
      <ul className="points">
        <li>
          <strong>Diligence held online.</strong> Company diligence is collected once and baselined, then refreshed
          quarterly or when something material changes.
        </li>
        <li>
          <strong>Matched lenders only.</strong> A raise is shared only with lenders whose thesis, rate band and risk
          appetite it fits. Lenders it doesn&apos;t fit never see it.
        </li>
        <li>
          <strong>Recurring drawdowns.</strong> Each borrower draws down on its own cycle, monthly, quarterly or
          yearly, and every new raise builds on the same file.
        </li>
        <li>
          <strong>Controlled access.</strong> Accounts are by invitation, every sign-in needs a one-time code sent to
          your work email, and platform data is stored in India, in Mumbai.
        </li>
      </ul>
      <p>
        The result is a raise that can reach several suitable lenders from a single proposal, on terms that are
        the same for all of them.
      </p>
    </GuideArticle>
  );
}
