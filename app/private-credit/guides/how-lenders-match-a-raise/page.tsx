import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE, creditGuide } from "@/lib/credit";
import { GuideArticle } from "@/components/credit/CreditBits";
import { MatchFunnel } from "@/components/credit/diagrams";

const slug = "how-lenders-match-a-raise";
const g = creditGuide(slug);
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/guides/${slug}`, title: g.title, description: g.description, type: "article" });

export default function Page() {
  return (
    <GuideArticle
      slug={slug}
      lede="Not every lending NBFC wants every raise. On the debt desk, a raise is matched to lenders on three things: their thesis, their rate band and their risk appetite. This guide explains each one and what it means for a borrowing NBFC."
    >
      <h2>Why matching matters</h2>
      <p>
        Lending NBFCs are selective. Each has segments it wants exposure to, a range of rates it works within, and
        a view on how much risk it will take. A raise sent to a lender outside those lines is unlikely to go
        anywhere, and it costs both sides time.
      </p>
      <p>
        Matching turns that around. Instead of the borrower approaching lenders one by one and finding out which
        ones are interested, each lender&apos;s profile records what it is looking for, and a raise is shared only
        with lenders it fits.
      </p>

      <h2>Thesis: what a lender wants exposure to</h2>
      <p>
        A lender&apos;s thesis is the set of segments it wants exposure to through the loans it funds. One lender
        might focus on auto loans, for example, while another looks for something else entirely.
      </p>
      <p>
        For a borrower, the thesis is where the nature of its own book matters most. A smaller NBFC with an
        auto-loan book is a natural fit for a lender whose thesis includes auto-loan exposure. Describing the book
        clearly and accurately is what allows the raise to reach the lenders who actually want it.
      </p>

      <h2>Rate band: the rates a lender works within</h2>
      <p>
        Each lender works within a rate band. A raise is compared with that band, and a lender sees it only when
        the raise sits inside it. A raise that falls outside one lender&apos;s band may still sit within
        another&apos;s.
      </p>
      <p>
        Within a raise, the rate is the same for every lender that takes part. That is part of parity: the same
        security, the same terms and the same rate for each lender in the raise.
      </p>

      <h2>Risk appetite: from more secure to higher-yield paper</h2>
      <p>
        Raises on the platform range from more secure paper to higher-yield paper. Each lender sets where it sits on
        that range. Some prefer the more secure end; others are comfortable further along it in return for a
        higher yield.
      </p>
      <p>
        Risk appetite is not a judgement on the borrower so much as a description of the lender. A raise that does
        not suit one lender&apos;s appetite may suit another&apos;s well.
      </p>

      <h2>All three, together</h2>
      <p>
        A raise is shared with a lender only when it fits all three: the lender&apos;s thesis, its rate band and its
        risk appetite. Lenders it doesn&apos;t fit never see it.
      </p>
      <figure>
        <MatchFunnel />
        <figcaption>Seen from a lender&apos;s side: raises on the platform pass the lender&apos;s three filters before they reach its deal flow. Illustrative only.</figcaption>
      </figure>
      <p>
        Matching happens after Level 1, the platform&apos;s own screening of the borrower. The lenders a raise is
        matched to then run their Level 2 diligence on the same files, and the raise can be sold down across those
        who take part.
      </p>

      <h2>What this means for a borrowing NBFC</h2>
      <ul className="points">
        <li>
          <strong>Your raise reaches lenders that fit it.</strong> The lenders who see your raise are the ones whose
          thesis, rate band and risk appetite it matches.
        </li>
        <li>
          <strong>Clarity about your book helps.</strong> The better your company information describes your book
          and the security behind the raise, the better the platform can match it.
        </li>
        <li>
          <strong>Several lenders, one set of terms.</strong> If more than one matched lender takes part, the raise
          is sold down across them at parity.
        </li>
        <li>
          <strong>Your raise stays contained.</strong> Lenders see only the raises shared with them, and within a
          raise only their own position, the total and how much is filled.
        </li>
      </ul>
      <p>
        Because each borrower draws down on its own cycle, monthly, quarterly or yearly, matching happens again
        with each new raise, starting from the same diligence file.
      </p>
    </GuideArticle>
  );
}
