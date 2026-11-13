import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE, creditGuide } from "@/lib/credit";
import { GuideArticle } from "@/components/credit/CreditBits";
import { CyclesDiagram } from "@/components/credit/diagrams";

const slug = "drawdown-cycle-monthly-quarterly-yearly";
const g = creditGuide(slug);
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/guides/${slug}`, title: g.title, description: g.description, type: "article" });

export default function Page() {
  return (
    <GuideArticle
      slug={slug}
      lede="A lending business needs funding again and again. This guide explains how recurring drawdowns work for a borrowing NBFC, how to think about a monthly, quarterly or yearly cycle, and why each raise should build on the last."
    >
      <h2>Why funding recurs</h2>
      <p>
        An NBFC&apos;s loan book does not stand still. New loans go out, existing loans repay, and the business
        plans for growth. Funding that matches today&apos;s book will not match the book a few quarters from now,
        so the need to raise comes back.
      </p>
      <p>
        Treating each raise as a separate, one-off deal makes that hard to plan. Each one has to be prepared,
        explained and placed from the beginning. A better approach is to treat funding as a series of drawdowns
        on a cycle that suits the book, with each drawdown starting from where the last one left off.
      </p>

      <h2>How recurring drawdowns work</h2>
      <p>
        On the debt desk, each borrower draws down on its own cycle: monthly, quarterly or yearly. Each drawdown is a
        new raise on the platform. It is matched to lenders on their thesis, rate band and risk appetite, shared
        only with the lenders it fits, and sold down across those who take part, with every lender in the raise on
        the same security, terms and rate.
      </p>
      <p>
        What does not start over is the file. The company diligence already held on the platform carries forward,
        so a new drawdown builds on the diligence and history that are already there.
      </p>
      <figure>
        <CyclesDiagram />
        <figcaption>Three borrowers over the same period, each drawing down on a different cycle. Illustrative only.</figcaption>
      </figure>

      <h2>Matching the cycle to the book</h2>
      <p>
        There is no single right cycle. The choice is a treasury decision, and it follows from how the loan book
        behaves. A few questions help frame it:
      </p>
      <ul className="points">
        <li>
          <strong>How steadily do you disburse?</strong> A book that grows at an even pace can draw down in step
          with it. A book with uneven or seasonal demand may prefer fewer, planned raises.
        </li>
        <li>
          <strong>How closely should funding track lending?</strong> Raising more often keeps funding close to
          actual need. Raising less often means holding funds for longer before they are lent out.
        </li>
        <li>
          <strong>How much time can the team give to each raise?</strong> Every drawdown is a raise, and a raise
          involves the team&apos;s attention even when the file is already in place.
        </li>
        <li>
          <strong>How settled is the business?</strong> A company whose information changes often will be updating
          its file more often, whatever cycle it chooses.
        </li>
      </ul>

      <h2>Monthly, quarterly or yearly</h2>
      <h3>Monthly</h3>
      <p>
        Drawing down monthly suits a borrower whose book disburses steadily and who wants funding to follow
        lending closely. It means the most frequent raises of the three options, so it works best when the company&apos;s
        information is well organised and the team is comfortable with a regular rhythm.
      </p>
      <h3>Quarterly</h3>
      <p>
        Drawing down quarterly sits between the two. It gives the treasury team a predictable rhythm without a raise
        always being in progress. It also lines up with the pace at which company diligence is refreshed on the
        platform, which is quarterly or when something material changes.
      </p>
      <h3>Yearly</h3>
      <p>
        Drawing down yearly suits a borrower that plans its funding well ahead and prefers fewer, larger raises. Each
        raise carries more weight, so the case for it, and the security behind it, deserve particular care.
      </p>

      <h2>Building on the same file</h2>
      <p>
        Whatever the cycle, the value of recurring drawdowns comes from continuity. On the platform, company
        diligence is collected once and baselined, then refreshed quarterly or when something material changes. A
        new raise does not mean rebuilding the file for each lender or each drawdown.
      </p>
      <p>
        That continuity helps lenders as well. Each matched lender runs its own diligence on the same files, and
        a borrower with a consistent, up-to-date file is easier to assess the next time a raise is shared.
      </p>

      <h2>Revisiting the choice</h2>
      <p>
        A cycle that fits the book today may not fit it once the business has grown or its mix has changed. It is
        worth reviewing the choice as part of regular funding planning, alongside the growth plan it supports. Our
        team can take you through how drawdowns work on the platform once your account is set up.
      </p>
    </GuideArticle>
  );
}
