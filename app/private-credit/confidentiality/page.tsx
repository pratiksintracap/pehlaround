import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell } from "@/components/credit/CreditBits";
import { Check, Cross } from "@/components/credit/glyphs";

const D = "Who sees what on the debt desk. Borrower diligence and raise terms go only to matched lenders, each lender sees only its own position, and nothing about a deal is on the public website.";
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/confidentiality`, title: "Debt desk confidentiality: who sees what", description: D });

type Cell = { yes: boolean; note?: string };
const ROWS: { item: string; matched: Cell; other: Cell; desk: Cell }[] = [
  { item: "A borrower's company diligence", matched: { yes: true, note: "for raises shared with it" }, other: { yes: false }, desk: { yes: true } },
  { item: "A raise and its terms", matched: { yes: true }, other: { yes: false, note: "doesn't know the raise exists" }, desk: { yes: true } },
  { item: "The total raise and how much is filled", matched: { yes: true }, other: { yes: false }, desk: { yes: true } },
  { item: "Which other lenders are in a raise, and their parts", matched: { yes: false }, other: { yes: false }, desk: { yes: true } },
  { item: "A lender's own position and diligence notes", matched: { yes: true, note: "its own only" }, other: { yes: false }, desk: { yes: true } },
];
const Mark = ({ c }: { c: Cell }) => <span className={`cr-cell ${c.yes ? "yes" : "no"}`}>{c.yes ? <Check /> : <Cross />}<span>{c.yes ? "Sees it" : "Doesn't see it"}{c.note && <small>{c.note}</small>}</span></span>;

export default function Confidentiality() {
  return (
    <CreditShell here="/confidentiality">
      <section className="cr-hero"><div className="wrap">
        <p className="cr-kick">Confidentiality</p>
        <h1>Each party sees only what belongs to them.</h1>
        <p className="cr-lede">Everything specific to a borrower, a lender or a raise sits behind sign-in. This website carries none of it.</p>
      </div></section>
      <section className="cr-sec"><div className="wrap">
        <div className="cr-head"><h2>Who sees what</h2><p>Access is checked on the server for every request, not just hidden on the screen.</p></div>
        <div className="cmpwrap"><table className="cr-matrix">
          <caption>The desk runs Level 1 diligence, matching and sell-down, so it sees every raise.</caption>
          <thead><tr><th scope="col">Information</th><th scope="col">A lender matched to the raise</th><th scope="col">Any other lender</th><th scope="col">The desk</th></tr></thead>
          <tbody>{ROWS.map((r) => <tr key={r.item}><th scope="row">{r.item}</th><td data-label="A lender matched to the raise"><Mark c={r.matched} /></td><td data-label="Any other lender"><Mark c={r.other} /></td><td data-label="The desk"><Mark c={r.desk} /></td></tr>)}</tbody>
        </table></div>
      </div></section>
      <section className="cr-sec alt"><div className="wrap cr-trio light">
        <div><h3>Access by invitation</h3><p>Accounts are set up by the desk. Every sign-in needs a one-time code sent to your work email, which expires after ten minutes. Idle sessions sign out on their own.</p></div>
        <div><h3>Data held in India</h3><p>Lending data, including diligence files, is stored in Mumbai. Email notifications tell you something needs attention and never carry deal details.</p></div>
        <div><h3>Nothing public</h3><p>No borrower or lender names, terms, rates, diligence or pipeline appear on this website, in search results or in link previews.</p></div>
      </div></section>
      <AccessBand title="Request access" body="Tell us whether you're borrowing, lending or raising a larger loan. The desk will get in touch to set up your account." />
    </CreditShell>
  );
}
