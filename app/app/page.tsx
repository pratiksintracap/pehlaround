import type { Metadata } from "next";
import { Mark } from "@/components/Mark";

const D = "Install Before the Bell on your phone: the shelf, deal rooms, NDAs, questions and allocations for your family office, one tap away.";
export const metadata: Metadata = { title: "Get the app", description: D, openGraph: { title: "The Before the Bell app", description: D } };

const FEATURES: [string, string][] = [
  ["Your shelf, live", "Every company on the desk with round size, valuation and P/E, updated the moment the desk changes them."],
  ["Rooms in your pocket", "Sign a company's NDA and open its room from your phone: financials, terms, IPO path, diligence and documents."],
  ["Ask, request, pass", "Ask the promoter a question, request a call or an allocation, or pass with a reason, in a couple of taps."],
  ["Your office's record", "NDAs, document views, calls and requests for everyone in your office, in one log."],
];

export default function AppPage() {
  return (
    <main>
      <div className="wrap appx" style={{ padding: "clamp(40px,6vw,72px) var(--gutter)" }}>
        <div className="appx-copy">
          <span className="eyebrow">Before the Bell app</span>
          <h1>Your deal desk, <em>on your phone.</em></h1>
          <p className="lede">Install Before the Bell on your iPhone or Android phone and manage your office&apos;s dashboard from anywhere. It opens straight to your dashboard, full screen, like any other app. No app store needed.</p>
          <div className="appx-cta">
            <a className="btn primary" href="/app?install=1" data-get-app="">Get the app</a>
            <span className="appx-installed fine" hidden>Installed. Open Before the Bell from your home screen.</span>
          </div>
          <div className="appx-steps">
            <div className="appx-step"><b>iPhone (Safari)</b><ol><li>Tap <b>Get the app</b> above (it opens Safari if you are in another app)</li><li>Tap the Share button</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b></li></ol></div>
            <div className="appx-step"><b>Android (Chrome)</b><ol><li>Tap <b>Get the app</b> above</li><li>Confirm <b>Install</b></li><li>Or use Chrome&apos;s ⋮ menu → <b>Install app</b></li></ol></div>
          </div>
          <p className="fine">Your office&apos;s data stays on our servers, not on the phone: if a phone is lost, nothing about your deals is stored on it. Sign out from the menu at any time.</p>
        </div>
        <div className="appx-phone" aria-hidden="true">
          <div className="appx-screen">
            <div className="appx-bar"><Mark /><b>Rao Family Office</b></div>
            <div className="appx-tiles"><div><small>Rooms open</small><b>2</b></div><div><small>Questions</small><b>3</b></div><div><small>Requested</small><b>₹2 Cr</b></div><div><small>Calls</small><b>1</b></div></div>
            {["Naval defence services", "Jewellery manufacturing", "AI-led collections software", "Grain ethanol and ENA"].map((t, i) => (
              <div key={t} className="appx-deal"><div><b>{t}</b><small>{["Pre-IPO secondary · Sept 2028", "Pre-IPO primary · Late 2028", "Growth round · Late 2028", "Pre-IPO primary · Jul 2027"][i]}</small></div><span className={`pill ${i < 2 ? "ok" : ""}`}>{i < 2 ? "NDA signed" : "Open"}</span></div>
            ))}
            <div className="appx-nav"><span className="on">Dashboard</span><span>Deals</span><span>Articles</span><span>Account</span></div>
          </div>
        </div>
        <section className="appx-feats">
          {FEATURES.map(([t, d]) => <div key={t}><b>{t}</b><p>{d}</p></div>)}
        </section>
      </div>
    </main>
  );
}
