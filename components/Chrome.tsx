import type { SessionUser } from "@/lib/auth";
import { Mark } from "@/components/Mark";
import { DESK_EMAIL, GRIEVANCE } from "@/lib/site";
import { isDesk } from "@/lib/perm";

const NAV = [
  ["/deals", "Deals"], ["/how-it-works", "How it works"], ["/about", "About us"],
  ["/founders", "List your company"], ["/dashboard", "Dashboard"],
] as const;

export function Header({ user, unread = 0 }: { user: SessionUser | null; unread?: number }) {
  return (
    <header className="hdr">
      <div className="wrap in">
        <a className="logo" aria-label="Before the Bell home" href="/"><Mark />Before the Bell</a>
        <nav aria-label="Main">
          {NAV.map(([h, t]) => <a key={h} href={h}>{t}</a>)}
          {isDesk(user) && <a href="/admin">Admin</a>}
        </nav>
        <div className="acts">
          <button type="button" className="iconbtn" id="shortlist-btn" aria-label="Your shortlist" title="Your shortlist" aria-expanded="false" aria-controls="shortlist">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10v14l-5-3.5L5 17z" /></svg><span className="badge" id="shortlist-count" hidden suppressHydrationWarning>0</span>
          </button>
          {user && (
            <a className="iconbtn" href="/notifications" aria-label={unread ? `${unread} unread notifications` : "Notifications"} title="Notifications">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5a5 5 0 0 0-5 5v3.2L3.5 13.5h13L15 10.7V7.5a5 5 0 0 0-5-5zM8 16a2 2 0 0 0 4 0" /></svg>
              {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
            </a>)}
          <button type="button" className="iconbtn" id="theme-btn" aria-label="Switch light or dark" title="Light / dark">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path className="sun" d="M10 4.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM10 1v2M10 17v2M1 10h2M17 10h2M3.6 3.6l1.4 1.4M15 15l1.4 1.4M3.6 16.4L5 15M15 5l1.4-1.4" /><path className="moon" d="M16 12.5A7 7 0 0 1 7.5 4a7 7 0 1 0 8.5 8.5z" /></svg>
          </button>
          {user ? (
            <>
              <a className="btn ghost sm hide-xs" href="/logout">Sign out</a>
              <a className="btn primary sm hide-xs" href={user.role === "promoter" ? "/founder" : "/dashboard"}>{user.office?.name ? "My office" : user.role === "promoter" ? "My company" : "Dashboard"}</a>
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
              {isDesk(user) && <a href="/admin">Admin</a>}
              {user && <a href="/notifications">Notifications{unread ? ` (${unread})` : ""}</a>}
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
            <a className="logo" href="/"><Mark />Before the Bell</a>
            <p><b>A front-row seat to India’s next listings.</b> IPO-bound companies for family offices, funds and qualified investors, vetted before you see them.</p>
            <a className="mail" href={`mailto:${DESK_EMAIL}`}>{DESK_EMAIL}</a>
          </div>
          <div className="ft-col"><h4>Explore</h4><ul>
            {NAV.map(([h, t]) => <li key={h}><a href={h}>{t}</a></li>)}
            <li><a href="/articles">Articles</a></li>
            <li><a href="/app">Get the app</a></li>
          </ul></div>
          <div className="ft-col"><h4>Operated by</h4><ul>
            <li className="kv"><b>SintraCap Advisors LLP</b>LLPIN ACL-6334 · <a href="https://sintracap.in" target="_blank" rel="noopener">sintracap.in</a></li>
            <li className="kv"><b>Office</b>602 Lodha Supremus, Lower Parel, Mumbai 400013</li>
            <li className="kv addr"><b>Registered office</b>B/3501, World View, Lodha World Towers, S.B. Marg, Lower Parel, Mumbai 400013</li>
          </ul></div>
          <div className="ft-col"><h4>Legal</h4><ul>
            <li><a href="/legal">Terms and privacy</a></li>
            <li><a href="#" data-show-disclaimer="">Site disclaimer</a></li>
            <li className="kv"><b>Grievance officer</b>{GRIEVANCE.name} · <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a></li>
          </ul></div>
        </div>
        <p className="ft-disc">Before the Bell is a deal desk. It is not a stock exchange, trading platform, broker, merchant banker or investment adviser, and is not registered with SEBI. Nothing on this website is an offer or invitation to subscribe for or buy securities. Any offer is made privately, only to identified investors, through a private placement offer letter or a share purchase agreement under the Companies Act, 2013. Deal overviews on this site are anonymised. Investments in unlisted companies are illiquid, may not list on the expected timeline or at all, and can lose their entire value. The desk charges family offices nothing.</p>
        <div className="ft-bottom"><span>© 2026 Before the Bell · SintraCap Advisors LLP</span><span>Mumbai, India</span></div>
      </div>
    </footer>
  );
}

/** Static HTML inside a <main>, ported from the original pages. */
export function Html({ html, as = "main", className }: { html: string; as?: "main" | "div" | "section"; className?: string }) {
  const T = as;
  return <T className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Bottom tab bar, shown only when Before the Bell runs as an installed app. */
export function AppBar({ user }: { user: SessionUser | null }) {
  const I = (d: string) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
  return (
    <nav className="appbar" aria-label="App">
      <a href="/dashboard">{I("M4 11 12 4l8 7v9h-5v-6H9v6H4z")}<span>Dashboard</span></a>
      <a href="/deals">{I("M4 6h16M4 12h16M4 18h10")}<span>Deals</span></a>
      <a href="/articles">{I("M6 4h12v16H6zM9 8h6M9 12h6M9 16h4")}<span>Articles</span></a>
      {isDesk(user)
        ? <a href="/admin">{I("M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z")}<span>Admin</span></a>
        : <a href={user ? "/dashboard#Team" : "/login"}>{I("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6")}<span>{user ? "Account" : "Sign in"}</span></a>}
    </nav>
  );
}
