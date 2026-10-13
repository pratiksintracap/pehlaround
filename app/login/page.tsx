import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { listDeals } from "@/lib/deals";
import { listArticles, artDate, artHref } from "@/lib/articles";
import { scoreSvg } from "@/lib/render";

export const metadata: Metadata = { title: "Sign in", description: "Your family office's shelf, deal rooms, calls, documents and log, in one place." };
type P = { searchParams: Promise<{ next?: string; error?: string }> };

const ICON: Record<string, string> = {
  fresh: "M4 7h16v13H4zM4 7l2-3h12l2 3M8 2v4M16 2v4M12 11v5M9.5 13.5h5",
  names: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  checked: "M3 21V10l5 3V10l5 3V6l8 4v11zM9 17l2 2 4-4",
  rooms: "M4 4h11l5 5v11H4zM15 4v5h5M8 13h8M8 17h5",
  ask: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  commit: "M4 8h16M4 16h16M9 5v6M15 13v6",
  told: "M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0",
  team: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c.5-3.5 3.5-6 7-6s6.5 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2 .8 3.5 3 4 6",
};
const HUE = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#ea580c", "#4f46e5"];
const Icon = ({ k, c }: { k: string; c: string }) => (
  <span className="lp-ic" style={{ ["--c" as string]: c }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[k]} /></svg></span>
);

const PERKS: [string, string, string][] = [
  ["fresh", "A new deal about every fortnight", "The desk brings a fresh company to the shelf roughly every two weeks on average, each one found directly with the promoter, not passed around by bankers."],
  ["names", "Every company, by name", "Once the desk approves your office: round size, pre-money and trailing and forward P/E for every deal on the desk."],
  ["checked", "Checked before it reaches you", "Site, factory and plant visits, customer orders verified, customer feedback taken and the numbers reconciled, before a company gets a room. Each one carries a Pehla Score."],
  ["rooms", "Rooms that open on screen", "Sign one NDA with that company and its data room opens at once: financials, terms, IPO path, diligence, risks and documents."],
  ["ask", "Ask the promoter, in writing", "Questions go to the company and the answers are posted for every office. Promoter sessions are set up by the desk."],
  ["commit", "Commit, or pass in one line", "Request an allocation with a slider, or pass with a reason. Nobody calls to change your mind."],
  ["told", "Told the moment it matters", "Approvals, answers, new documents and new deals arrive under the bell, in the app on your phone, and by email."],
  ["team", "Your whole office, one record", "Add your CIO, CFO or CA. Every NDA, document view and request is logged against a name."],
];

const FAQ: [string, string][] = [
  ["Does it cost the office anything?", "No. Not to register, not to open a room, not to commit."],
  ["Does our money pass through the desk?", "Never. It goes directly to the company or the seller under signed documents, and the shares land in your demat."],
  ["Who sees our office's details?", "Only the desk. Companies see your office's name on the NDA you sign with them, and nothing else until you commit."],
  ["What if we pass on a deal?", "Pass in one line from the room. You keep seeing every new deal; nobody follows up to change your mind."],
];

export default async function Login({ searchParams }: P) {
  const { next = "", error } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  const all = await listDeals();
  const deals = all.slice(0, 4);
  const arts = await listArticles(3);
  const months = all.map((d) => d.listingMonth).filter((m): m is string => !!m).sort();
  const lbl = (ym: string) => new Date(ym + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const listingSpan = months.length ? (months[0] === months[months.length - 1] ? lbl(months[0]) : `${lbl(months[0])} – ${lbl(months[months.length - 1])}`) : "—";
  const reg = `/register${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <main>
      <div className="wrap lp" style={{ padding: "clamp(40px,6vw,72px) var(--gutter)" }}>
        <div className="lp-copy rv inview">
          <span className="eyebrow">Family offices</span>
          <h1>Your office&apos;s desk, <em>one sign-in away.</em></h1>
          <p className="lede">IPO-bound companies the market has not found yet, each in the same structured room. Registered offices see the names and the numbers; nobody else does.</p>

          <div className="lp-mock" aria-label="Preview of the office dashboard">
            <div className="lp-mock-top"><span className="lp-dots"><i /><i /><i /></span><span className="mono">Office dashboard</span><span className="pill ok">PAN on record</span></div>
            <div className="lp-mock-tabs"><b>Shelf</b><span>My rooms</span><span>Calls</span><span>Documents</span><span>Portfolio</span><span>Log</span></div>
            <ul className="lp-rows">
              {deals.map((d, i) => (
                <li key={d.id}>
                  <div><span className="lp-co"><span className="redact" aria-hidden="true">{"█".repeat(Math.min(16, Math.max(9, d.company.length - 6)))}</span></span><small>{d.title}</small></div>
                  <span className="lp-num"><span className="redact" aria-label="Round size, after approval">₹00 Cr</span></span>
                  <span className="lp-num"><span className="redact" aria-label="P/E, after approval">00x · 00x</span></span>
                  <span className={`pill ${i === 0 ? "ok" : ""}`}>{i === 0 ? "NDA signed" : "Room open"}</span>
                </li>
              ))}
            </ul>
            <div className="lp-mock-foot"><span><b>3</b> questions answered</span><span><b>1</b> call scheduled</span><span><b>₹2 Cr</b> requested</span></div>
            <div className="lp-veil"><span className="lock" />Company names open when you sign in</div>
          </div>
        </div>

        <div className="lp-side rv inview" style={{ ["--d" as string]: ".1s" }}>
          <form className="form lp-form" method="post" action="/api/auth/login" data-api="">
            <span className="eyebrow">Sign in</span>
            <input type="hidden" name="next" value={next} />
            {error && <div className="ok show bad" role="alert">{error}</div>}
            <label>Email<input type="email" required autoComplete="email" name="email" /></label>
            <label>Password<input type="password" required autoComplete="current-password" name="password" /></label>
            <div><button className="btn primary" type="submit">Sign in</button></div>
            <p className="fine"><a href="/forgot">Forgotten your password?</a></p>
          </form>
          <div className="lp-reg">
            <b>New to the desk?</b>
            <p>Registration takes a minute and costs your office nothing: not to register, not to open a room, not to commit. A new deal reaches the desk about every fortnight.</p>
            <a className="btn" href={reg}>Register your family office</a>
          </div>
        </div>

        <section className="lp-stats" aria-label="The desk today">
          <div><Icon k="rooms" c="#2563eb" /><b>{all.length}</b><span>companies on the desk now</span></div>
          <div><Icon k="fresh" c="#059669" /><b>~2 weeks</b><span>between new deals, on average</span></div>
          <div><Icon k="told" c="#d97706" /><b>{listingSpan}</b><span>target listings on the shelf</span></div>
          <div><Icon k="names" c="#db2777" /><b>₹0</b><span>fee for family offices</span></div>
        </section>

        <section className="lp-perks" aria-label="What registered offices get">
          {PERKS.map(([k, t, d], i) => (
            <div key={t} className="lp-perk rv inview" style={{ ["--d" as string]: `${i * 0.05}s`, ["--c" as string]: HUE[i % HUE.length] }}>
              <Icon k={k} c={HUE[i % HUE.length]} /><b>{t}</b><p>{d}</p>
            </div>
          ))}
        </section>

        <section className="lp-block" aria-label="On the desk now">
          <div className="lp-bhead"><span className="eyebrow">On the desk now</span><h2>What your office would see today</h2><p>Shown here without company names. Names, round terms and rooms open once the desk approves your office.</p></div>
          <ul className="lp-shelf">{all.map((d) => (
            <li key={d.id}><a href={`/deals/${d.slug}`}>
              <span className="lp-sc" dangerouslySetInnerHTML={{ __html: d.score != null ? scoreSvg(d.score, 40) : "" }} />
              <span className="lp-st"><b>{d.title}</b><small>{d.category} · target listing {d.listingLabel}</small></span>
              <span className="lp-go" aria-hidden="true">→</span></a></li>))}</ul>
        </section>

        <section className="lp-block" aria-label="How it works">
          <div className="lp-bhead"><span className="eyebrow">Three steps</span><h2>From sign-up to a deal room</h2></div>
          <ol className="lp-steps">
            <li><b>Register the office</b><p>One form: name, office, email, mobile and role.</p></li>
            <li><b>Approved by the desk</b><p>Usually within a working day. Every company then opens to you by name.</p></li>
            <li><b>Sign that company&apos;s NDA</b><p>On screen. Its data room opens at once, and only that one.</p></li>
          </ol>
        </section>

        <section className="lp-two">
          <div className="lp-block">
            <div className="lp-bhead"><span className="eyebrow">Questions</span><h2>Before you register</h2></div>
            <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
          </div>
          <div className="lp-block">
            <div className="lp-bhead"><span className="eyebrow">From the desk</span><h2>Latest articles</h2></div>
            <ul className="lp-arts">{arts.map((a) => <li key={a.id}><a href={artHref(a)}><span className="mono">{artDate(a.publishedAt)}</span><b>{a.title}</b></a></li>)}</ul>
            <a className="btn sm" href="/articles">All articles</a>
          </div>
        </section>

        <section className="lp-trust" aria-label="Why offices trust the desk">
          <span>Backed by <a href="https://sintracap.in" target="_blank" rel="noopener">SintraCap</a>, a family office investing its own capital</span>
          <span>One NDA per company</span><span>Money never passes through the desk</span><span>Install it as an app: <a href="/app">get the app</a></span>
        </section>
      </div>
    </main>
  );
}
