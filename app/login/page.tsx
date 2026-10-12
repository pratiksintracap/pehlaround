import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { listDeals } from "@/lib/deals";

export const metadata: Metadata = { title: "Sign in", description: "Your family office's shelf, deal rooms, calls, documents and log, in one place." };
type P = { searchParams: Promise<{ next?: string; error?: string }> };

const PERKS: [string, string][] = [
  ["Every company, by name", "Round size, pre-money and trailing and forward P/E for every deal on the desk, the moment you register."],
  ["Rooms that open on screen", "Sign one NDA with that company and its data room opens at once: financials, terms, IPO path, diligence and documents."],
  ["Ask the promoter, in writing", "Questions go to the company and the answers are posted for every office. Group calls are set up by the desk."],
  ["Commit, or pass in one line", "Request an allocation with a slider, or pass with a reason. Nobody calls to change your mind."],
  ["Your whole office, one record", "Add your CIO, CFO or CA. Every NDA, document view and request is logged against a name."],
];

export default async function Login({ searchParams }: P) {
  const { next = "", error } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  const deals = (await listDeals()).slice(0, 4);
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
                  <span className="lp-num">{d.roundLabel}</span>
                  <span className="lp-num">{d.peLabel !== "—" ? d.peLabel : "—"}</span>
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
            <p>Registration takes a minute and costs your office nothing: not to register, not to open a room, not to commit.</p>
            <a className="btn" href={reg}>Register your family office</a>
          </div>
        </div>

        <section className="lp-perks" aria-label="What registered offices get">
          {PERKS.map(([t, d], i) => (
            <div key={t} className="lp-perk rv inview" style={{ ["--d" as string]: `${i * 0.05}s` }}>
              <span className="lp-n">{String(i + 1).padStart(2, "0")}</span><b>{t}</b><p>{d}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
