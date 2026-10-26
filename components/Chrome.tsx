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
              <button type="button" className="mnav-theme" data-theme-toggle=""><span className="to-dark">Dark mode</span><span className="to-light">Light mode</span><svg viewBox="0 0 20 20" aria-hidden="true"><path className="sun" d="M10 4.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM10 1v2M10 17v2M1 10h2M17 10h2M3.6 3.6l1.4 1.4M15 15l1.4 1.4M3.6 16.4L5 15M15 5l1.4-1.4" /><path className="moon" d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9z" /></svg></button>
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
            <li><a href="/pre-ipo-investing">Pre-IPO investing guide</a></li>
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
        <p className="ft-disc">Before the Bell is a deal desk. It is not a stock exchange, trading platform, broker, merchant banker or investment adviser, and is not registered with SEBI. Nothing on this website is an offer or invitation to subscribe for or buy securities. Any offer is made privately, only to identified investors, through a private placement offer letter or a share purchase agreement under the Companies Act, 2013. Deal overviews on this site are anonymised. Investments in unlisted companies are illiquid, may not list on the expected timeline or at all, and can lose their entire value.</p>
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

/** Bottom tab bar, shown only when Before the Bell runs as an installed app.
 *  The desk gets its own four tabs (Today, Pipeline, Investors, Tasks); investors get Home, Deals, Alerts and Account.
 *  Articles are left out of the app on purpose: they are there for search, not for people already signed in. */
export function AppBar({ user, unread = 0 }: { user: SessionUser | null; unread?: number }) {
  const I = (d: string) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
  const tabs: [string, string, string, number?][] = isDesk(user) ? [
    ["/desk", "Today", "M4 11 12 4l8 7v9h-5v-6H9v6H4z"],
    ["/desk/pipeline", "Pipeline", "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z"],
    ["/desk/investors", "Investors", "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.9.7 3.2 2.4 3.5 5.2"],
    ["/desk/tasks", "Tasks", "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"],
  ] : user ? [
    ["/dashboard", "Dashboard", "M4 11 12 4l8 7v9h-5v-6H9v6H4z"],
    ["/deals", "Deals", "M4 6h16M4 12h16M4 18h10"],
    ["/notifications", "Alerts", "M12 3a5 5 0 0 0-5 5v3.5L5 15h14l-2-3.5V8a5 5 0 0 0-5-5zM10 18a2 2 0 0 0 4 0", unread],
    ["/dashboard#Team", "Account", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6"],
  ] : [
    ["/deals", "Deals", "M4 6h16M4 12h16M4 18h10"],
    ["/login", "Sign in", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6"],
  ];
  return (
    <nav className="appbar" aria-label="App" style={{ gridTemplateColumns: `repeat(${tabs.length},1fr)` }}>
      {tabs.map(([h, t, d, n]) => <a key={h} href={h}>{I(d)}<span>{t}</span>{n ? <i className="appbar-badge">{n > 9 ? "9+" : n}</i> : null}</a>)}
    </nav>
  );
}

/** Lights the current tab before the page paints (the longest matching path wins). */
export const APPBAR_CURRENT = `(function(){try{var p=location.pathname.replace(/^\\/desk\\/deals(\\/|$)/,"/desk/pipeline/"),b=null,l=-1;document.querySelectorAll(".appbar a").forEach(function(a){var h=a.getAttribute("href").split("#")[0];if((p===h||p.indexOf(h+"/")===0)&&h.length>l){b=a;l=h.length}});if(b)b.setAttribute("aria-current","page")}catch(e){}})()`;
