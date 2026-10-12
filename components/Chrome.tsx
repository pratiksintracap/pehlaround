import type { SessionUser } from "@/lib/auth";
import { DESK_EMAIL, GRIEVANCE } from "@/lib/site";

const NAV = [
  ["/deals", "Deals"], ["/how-it-works", "How it works"], ["/about", "About us"],
  ["/founders", "List your company"], ["/dashboard", "Dashboard"],
] as const;

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="hdr">
      <div className="wrap in">
        <a className="logo" aria-label="Pehla Round home" href="/"><span className="mk" aria-hidden="true">1</span>Pehla Round</a>
        <nav aria-label="Main">
          {NAV.map(([h, t]) => <a key={h} href={h}>{t}</a>)}
          {user?.role === "admin" && <a href="/admin">Admin</a>}
        </nav>
        <div className="acts">
          <button type="button" className="iconbtn" id="shortlist-btn" aria-label="Your shortlist" title="Your shortlist" aria-expanded="false" aria-controls="shortlist">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10v14l-5-3.5L5 17z" /></svg><span className="badge" id="shortlist-count" hidden>0</span>
          </button>
          <button type="button" className="iconbtn" id="theme-btn" aria-label="Switch light or dark" title="Light / dark">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path className="sun" d="M10 4.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM10 1v2M10 17v2M1 10h2M17 10h2M3.6 3.6l1.4 1.4M15 15l1.4 1.4M3.6 16.4L5 15M15 5l1.4-1.4" /><path className="moon" d="M16 12.5A7 7 0 0 1 7.5 4a7 7 0 1 0 8.5 8.5z" /></svg>
          </button>
          {user ? (
            <>
              <a className="btn ghost sm hide-xs" href="/logout">Sign out</a>
              <a className="btn primary sm hide-xs" href="/dashboard">{user.office?.name ? "My office" : "Dashboard"}</a>
            </>
          ) : (
            <>
              <a className="btn ghost sm hide-xs" href="/login">Sign in</a>
              <a className="btn primary sm hide-xs" href="/register">Register</a>
            </>
          )}
          <div className="mnav">
            <button type="button" className="mnav-btn" aria-expanded="false" aria-controls="mnav-panel" aria-label="Open menu">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7 H20 M4 12 H20 M4 17 H20" /></svg>
            </button>
            <div id="mnav-panel" role="navigation" className="mnav-panel" aria-label="Site">
              {NAV.map(([h, t]) => <a key={h} href={h}>{t}</a>)}
              {user?.role === "admin" && <a href="/admin">Admin</a>}
              {user ? <a href="/logout">Sign out</a> : <><a href="/login">Sign in</a><a href="/register">Register</a></>}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="ft-grid">
          <div className="ft-brand">
            <a className="logo" href="/"><span className="mk" aria-hidden="true">1</span>Pehla Round</a>
            <p>IPO-bound gems for family offices, checked before you see them.</p>
            <a className="mail" href={`mailto:${DESK_EMAIL}`}>{DESK_EMAIL}</a>
          </div>
          <div className="ft-col"><h4>Explore</h4><ul>
            {NAV.map(([h, t]) => <li key={h}><a href={h}>{t}</a></li>)}
            <li><a href="/articles">Articles</a></li>
          </ul></div>
          <div className="ft-col"><h4>Operated by</h4><ul>
            <li className="kv"><b>SintraCap Advisors LLP</b>LLPIN ACL-6334</li>
            <li className="kv"><b>Office</b>602 Lodha Supremus, Lower Parel, Mumbai 400013</li>
            <li className="kv"><b>Registered office</b>B/3501, World View, Lodha World Towers, S.B. Marg, Lower Parel, Mumbai 400013</li>
          </ul></div>
          <div className="ft-col"><h4>Legal</h4><ul>
            <li><a href="/legal">Terms and privacy</a></li>
            <li><a href="#" data-show-disclaimer="">Site disclaimer</a></li>
            <li className="kv"><b>Grievance officer</b>{GRIEVANCE.name} · <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a></li>
          </ul></div>
        </div>
        <p className="ft-disc">Pehla Round is a deal desk. It is not a stock exchange, trading platform, broker, merchant banker or investment adviser, and is not registered with SEBI. Nothing on this website is an offer or invitation to subscribe for or buy securities. Any offer is made privately, only to identified family offices, through a private placement offer letter or a share purchase agreement under the Companies Act, 2013. Deal overviews on this site are anonymised. Investments in unlisted companies are illiquid, may not list on the expected timeline or at all, and can lose their entire value. The desk charges family offices nothing.</p>
        <div className="ft-bottom"><span>© 2026 Pehla Round · SintraCap Advisors LLP</span><span>Mumbai, India</span></div>
      </div>
    </footer>
  );
}

/** Static HTML inside a <main>, ported from the original pages. */
export function Html({ html, as = "main", className }: { html: string; as?: "main" | "div" | "section"; className?: string }) {
  const T = as;
  return <T className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
