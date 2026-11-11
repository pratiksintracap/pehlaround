import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices } from "@/db/schema";
import { listDeals } from "@/lib/deals";
import { proposalByToken, proposer } from "@/lib/ipo-proposal";
import { IPO_CATEGORY, IPO_DISCLAIMER, fmtAmount, ipoStage, type IpoCategory } from "@/lib/ipo";
import { fmtIso } from "@/lib/closing";

export const metadata: Metadata = { title: "Confirm your IPO interest", robots: { index: false, follow: false } };
type P = { params: Promise<{ token: string }>; searchParams: Promise<{ msg?: string; error?: string }> };

/** Where a client answers IPO interest its partner firm entered for it. Opened from a personal link; no sign-in. */
export default async function Confirm({ params, searchParams }: P) {
  const { token } = await params;
  const { msg, error } = await searchParams;
  const Shell = ({ children }: { children: React.ReactNode }) => <main><div className="wrap" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 680 }}>{children}</div></main>;
  if (token === "done" || msg || error) return <Shell><span className="eyebrow">IPO interest</span><h1>{error ? "Not done" : "Thank you"}</h1><p className="lede">{msg || error}</p><p><a className="btn" href="/dashboard#IPOs">Open your dashboard</a></p></Shell>;
  const b = await proposalByToken(token);
  const d = b ? (await listDeals(true)).find((x) => x.id === b.dealId) : null;
  if (!b || !d) return <Shell><span className="eyebrow">IPO interest</span><h1>This link is no longer valid</h1><p className="lede">It has already been answered, or was replaced by a newer one. Your dashboard shows where things stand.</p><p><a className="btn" href="/dashboard#IPOs">Open your dashboard</a></p></Shell>;
  const [by, [o]] = await Promise.all([proposer(b), (await getDb()).select({ name: offices.name }).from(offices).where(eq(offices.id, b.officeId))]);
  const open = ipoStage(d.ipo) === "open";
  return (
    <Shell>
      <span className="eyebrow">For {o?.name}</span>
      <h1>Confirm your interest in {d.company}&apos;s IPO</h1>
      <p className="lede">{by.person} of {by.firm} entered this for you. Nothing is registered until you confirm it.</p>
      <dl className="terms compact" style={{ marginTop: 18 }}>
        <div><dt>Company</dt><dd>{d.company}{d.ipo.exchange ? ` · ${d.ipo.exchange}` : ""}</dd></div>
        <div><dt>Amount</dt><dd>{fmtAmount(b.amountCr)}</dd></div>
        <div><dt>Category</dt><dd>{IPO_CATEGORY[b.category as IpoCategory]?.label ?? b.category}</dd></div>
        {b.broker && <div><dt>Applying through</dt><dd>{b.broker}</dd></div>}
        <div><dt>Price band</dt><dd>{d.ipo.priceBand || "In the prospectus"}</dd></div>
        <div><dt>Issue</dt><dd>{d.ipo.opens ? `${fmtIso(d.ipo.opens)}${d.ipo.closes ? ` to ${fmtIso(d.ipo.closes)}` : ""}` : "Dates to be announced"}</dd></div>
      </dl>
      {open ? <form method="post" action="/api/ipo/confirm" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}><input type="hidden" name="token" value={token} />
        <button className="btn primary" type="submit" name="answer" value="confirm">Confirm my interest</button>
        <button className="btn ghost" type="submit" name="answer" value="decline">Decline</button></form>
        : <p className="notice" style={{ marginTop: 18 }}>This issue has closed, so interest can no longer be registered.</p>}
      <p className="fine" style={{ marginTop: 18 }}>{IPO_DISCLAIMER} The desk takes no view on the price. To change the amount, decline and register your own from your dashboard.</p>
      <p className="fine">Before the Bell is operated by SintraCap Advisors LLP.</p>
    </Shell>
  );
}
