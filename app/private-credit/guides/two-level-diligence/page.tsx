import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE, creditGuide } from "@/lib/credit";
import { GuideArticle } from "@/components/credit/CreditBits";
import { TwoLevelDiagram } from "@/components/credit/diagrams";

const slug = "two-level-diligence";
const g = creditGuide(slug);
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/guides/${slug}`, title: g.title, description: g.description, type: "article" });

export default function Page() {
  return (
    <GuideArticle
      slug={slug}
      lede="Before a lending NBFC takes part in a raise, it needs to understand the borrower. On the debt desk that happens at two levels, on one set of files. This guide explains both levels and how a borrowing NBFC can stay ready for them."
    >
      <h2>Why diligence comes first</h2>
      <p>
        Every lender wants to know who it is lending to before it commits. For a borrowing NBFC, that means
        lenders will look closely at the company, its book and the security offered for the raise. Diligence is
        not a formality to get past; it is how a lender gets comfortable enough to take part.
      </p>
      <p>
        When a raise is placed with one lender at a time, the borrower goes through that process separately with
        each of them. Two-level diligence is designed to avoid repeating the groundwork while leaving every
        lender&apos;s judgement fully its own.
      </p>

      <h2>Level 1: the platform&apos;s screening</h2>
      <p>
        Level 1 is the platform&apos;s own screening of the borrower. The company diligence is hosted online, and
        the platform&apos;s team reviews it before any raise is shared with a lender. A raise does not reach lenders
        until this step is done.
      </p>
      <p>
        For lenders, Level 1 means the raises they see have already been screened. For borrowers, it means the
        company file is assembled and reviewed once, in one place, before matching begins.
      </p>

      <h2>Level 2: each lender&apos;s own diligence</h2>
      <p>
        Level 2 is each matched lender&apos;s own diligence on the borrower. It runs on the same files that were
        screened at Level 1, so the borrower does not need to rebuild its information for every lender.
      </p>
      <p>
        Level 2 does not replace a lender&apos;s judgement with the platform&apos;s. Each lender runs its own
        diligence and reaches its own view. What changes is the starting point: every matched lender begins from the
        same organised, screened file rather than a fresh request.
      </p>
      <figure>
        <TwoLevelDiagram />
        <figcaption>Level 1 happens once on the platform; Level 2 happens separately for each matched lender, on the same files.</figcaption>
      </figure>

      <h2>Baselined once, refreshed over time</h2>
      <p>
        Company diligence on the platform is baselined once. After that it is refreshed quarterly, or sooner when
        something material changes. The file stays current without being rebuilt from the beginning for each raise
        or each drawdown.
      </p>
      <p>
        This matters most for borrowers who raise repeatedly. Whether a borrower draws down monthly, quarterly or
        yearly, each new raise starts from a file that is already in place and already up to date.
      </p>

      <h2>How to be ready</h2>
      <p>
        Readiness is less about any single document and more about how a company keeps its information. Our team
        takes each borrower through the specifics once its account is set up. In the meantime, a few habits make
        both levels of diligence smoother.
      </p>
      <ul className="points">
        <li>
          <strong>Keep your company information current and organised.</strong> Information that is up to date,
          clearly labelled and easy to find is quicker to review at Level 1 and quicker for each lender to work
          through at Level 2.
        </li>
        <li>
          <strong>Give the file an owner.</strong> One person in the finance or treasury team who knows what is in
          the file, and what has changed since it was last refreshed, saves time on every raise.
        </li>
        <li>
          <strong>Be consistent.</strong> The same facts should read the same way wherever they appear. Small
          inconsistencies prompt questions that a well-kept file avoids.
        </li>
        <li>
          <strong>Flag material changes early.</strong> If something significant changes in the business, say so
          rather than waiting for the next scheduled refresh. Lenders take more comfort from a borrower that raises
          changes itself.
        </li>
        <li>
          <strong>Explain, don&apos;t omit.</strong> Every book has its weaker parts. A clear explanation alongside
          them is more useful to a lender than a gap it has to ask about.
        </li>
      </ul>
      <p>
        Please don&apos;t send financials or deal details when you request access. Company diligence is collected
        on the platform once your account is set up.
      </p>

      <h2>Who sees the files</h2>
      <p>
        A raise, and the diligence behind it, is shared only with lenders it has been matched to. Lenders see only
        the raises shared with them, and within a raise they see their own position, the total and how much is
        filled, not who the other lenders are. Accounts are by invitation, every sign-in needs a one-time code sent
        to a work email, and platform data is stored in India, in Mumbai.
      </p>
    </GuideArticle>
  );
}
