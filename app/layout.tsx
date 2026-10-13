import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header, Footer, AppBar } from "@/components/Chrome";
import { AppPromo, InstallGuide } from "@/components/AppPromo";
import { getUser } from "@/lib/auth";
import { listDeals, publicData } from "@/lib/deals";
import { content } from "@/lib/content";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings";
import { unreadCount } from "@/lib/notify";

export const dynamic = "force-dynamic";

const DESC = "Undiscovered, profitable, IPO-bound private companies for family offices. Checked before you see them, each in the same structured deal room.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Off Market Desk · A front-row seat before the listing", template: "%s · Off Market Desk" },
  description: DESC,
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/favicon-32.png", type: "image/png", sizes: "32x32" }], apple: "/apple-touch-icon.png" },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "Off Market Desk", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", siteName: "Off Market Desk", title: "Off Market Desk · A front-row seat before the listing", description: DESC,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Off Market Desk: a front-row seat before the listing." }] },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
};
export const viewport: Viewport = { themeColor: "#0b1730", width: "device-width", initialScale: 1, viewportFit: "cover" };

const THEME = `try{var t=JSON.parse(localStorage.getItem("ud_theme")||"null");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}
try{if(matchMedia("(display-mode: standalone)").matches||navigator.standalone===true){document.documentElement.classList.add("is-app");var p=location.pathname;if(p==="/"||p==="/app"||p==="/how-it-works"||p==="/about"||p==="/founders"||p==="/webinars")location.replace("/dashboard")}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, deals, st] = await Promise.all([getUser(), listDeals(), getSettings()]);
  const unread = await unreadCount(user);
  const data = JSON.stringify(publicData(deals)).replace(/</g, "\\u003c");
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body data-user={user ? (user.role === "admin" ? "admin" : "member") : ""}>
        {st.announcement && (
          <div className="annc"><div className="wrap">{st.announcementLink ? <a href={st.announcementLink}>{st.announcement} <span aria-hidden="true">→</span></a> : st.announcement}</div></div>)}
        <Header user={user} unread={unread} />
        {children}
        <Footer />
        <AppBar user={user} />
        <div className="ap-smart"><AppPromo variant="bar" text="Install it on your phone. Opens straight to your dashboard." /></div>
        <InstallGuide />
        <script id="ud-data" type="application/json" dangerouslySetInnerHTML={{ __html: data }} />
        <div dangerouslySetInnerHTML={{ __html: content("drawer") }} />
        <div dangerouslySetInnerHTML={{ __html: content("disclaimer") }} />
        <Script src="/js/site.js?v=34" strategy="afterInteractive" />
        <Analytics />
      </body>
    </html>
  );
}
