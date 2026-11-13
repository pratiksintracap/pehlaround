// Private credit: the NBFC Desk business under the Before the Bell brand (secured NBFC-to-NBFC lending and direct
// lending to companies). The public pages live at /private-credit; the lender and admin console (with its own sign-in,
// lender isolation and maker-checker) stays a separate app, at CREDIT_APP.
export const CREDIT_APP = process.env.NEXT_PUBLIC_CREDIT_APP ?? "https://app.nbfcdesk.com";
export const CREDIT_BASE = "/private-credit";

export type CreditGuide = { slug: string; title: string; description: string; summary: string };
export const CREDIT_GUIDES: CreditGuide[] = [
  { slug: "raise-secured-debt-from-larger-nbfcs", title: "How smaller NBFCs can raise secured debt from larger NBFCs",
    description: "A guide to NBFC-to-NBFC lending in India for smaller NBFCs: how a secured raise works, how one proposal can be sold down across several lenders, and what parity means.",
    summary: "What NBFC-to-NBFC lending is, why the debt is secured, and how one proposal can reach several lenders at parity." },
  { slug: "drawdown-cycle-monthly-quarterly-yearly", title: "Choosing a drawdown cycle: monthly, quarterly or yearly",
    description: "How recurring drawdowns work for a borrowing NBFC, how to match a monthly, quarterly or yearly drawdown cycle to your loan book, and why each raise builds on the same file.",
    summary: "How recurring drawdowns work, how to match the cycle to your book, and why each raise starts from the same file." },
  { slug: "two-level-diligence", title: "How two-level diligence works, and how to be ready for it",
    description: "Level 1 platform screening and Level 2 lender diligence on the same files, explained for borrowing NBFCs, with practical advice on keeping your company information ready.",
    summary: "Platform screening first, then each lender's own diligence on the same files, and how to keep your company ready for both." },
  { slug: "how-lenders-match-a-raise", title: "How lenders match a raise: thesis, rate band and risk appetite",
    description: "How a secured raise from a smaller NBFC is matched to lending NBFCs on thesis, rate band and risk appetite, and what that means for how you present your book.",
    summary: "The three things a lending NBFC's profile records, and what they mean for how your raise reaches lenders." },
];
export const creditGuide = (slug: string) => {
  const g = CREDIT_GUIDES.find((x) => x.slug === slug);
  if (!g) throw new Error(`Unknown guide: ${slug}`);
  return g;
};
