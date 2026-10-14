// "Get the app" promotions and the install guide. The button's behaviour is set per phone in site.js:
// iPhone in another browser → opens Safari; iPhone Safari → home-screen steps; Android → one-tap install
// (or opens Chrome from in-app browsers); laptop → a QR code to scan. Hidden inside the installed app.
import QRCode from "qrcode";
import { SITE_URL } from "@/lib/site";

const PHONE = <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 18h4" /></svg>;

export function AppPromo({ variant = "card", text }: { variant?: "card" | "bar"; text?: string }) {
  return (
    <div className={`app-promo ${variant}`} data-app-promo="">
      <span className="ap-ic">{PHONE}</span>
      <div className="ap-t"><b>Get the Before the Bell app</b><span>{text || "Your dashboard on your home screen: new deals, answers and approvals the moment they land."}</span></div>
      <a className="btn primary sm" href="/app?install=1" data-get-app="">Get the app</a>
      {variant === "bar" && <button type="button" className="ap-x" aria-label="Dismiss" data-ap-dismiss="">×</button>}
    </div>
  );
}

/** One overlay per page with the platform-specific steps; site.js shows the right panel. */
export async function InstallGuide() {
  const qr = await QRCode.toString(`${SITE_URL}/app?install=1`, { type: "svg", margin: 1, width: 180, color: { dark: "#0b1730", light: "#ffffff" } });
  const share = <svg viewBox="0 0 24 24" className="ig-glyph" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" /></svg>;
  return (
    <div className="ig" id="install-guide" hidden role="dialog" aria-modal="true" aria-labelledby="ig-h">
      <div className="ig-card">
        <button type="button" className="ig-x" data-ig-close="" aria-label="Close">×</button>
        <span className="eyebrow">Before the Bell app</span>
        <h2 id="ig-h">Add it to your home screen</h2>
        <div data-ig="ios">
          <ol className="ig-steps">
            <li><span className="ig-n">1</span><span>Tap the <b>Share</b> button {share} in Safari&apos;s toolbar</span></li>
            <li><span className="ig-n">2</span><span>Scroll down and tap <b>Add to Home Screen</b></span></li>
            <li><span className="ig-n">3</span><span>Tap <b>Add</b>. Before the Bell opens straight to your dashboard</span></li>
          </ol>
          <div className="ig-arrow" aria-hidden="true"><span>Share is down here</span><svg viewBox="0 0 24 24"><path d="M12 3v16M6 13l6 6 6-6" /></svg></div>
        </div>
        <div data-ig="ios-other" hidden>
          <p>Apple only lets Safari add apps to the home screen.</p>
          <ol className="ig-steps">
            <li><span className="ig-n">1</span><span>Tap the <b>⋯</b> or <b>Share</b> menu of this browser</span></li>
            <li><span className="ig-n">2</span><span>Choose <b>Open in Safari</b> (or copy the link and paste it into Safari)</span></li>
            <li><span className="ig-n">3</span><span>In Safari, tap <b>Get the app</b> again</span></li>
          </ol>
          <button type="button" className="btn sm" data-copy-link="">Copy the link</button>
        </div>
        <div data-ig="android" hidden>
          <ol className="ig-steps">
            <li><span className="ig-n">1</span><span>Tap Chrome&apos;s <b>⋮</b> menu, top right</span></li>
            <li><span className="ig-n">2</span><span>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</span></li>
            <li><span className="ig-n">3</span><span>Open Before the Bell from your home screen. It lands on your dashboard</span></li>
          </ol>
        </div>
        <div data-ig="desktop" hidden>
          <p>Scan with your phone&apos;s camera to install it there.</p>
          <div className="ig-qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="fine">Or open <span className="mono">{SITE_URL.replace(/^https?:\/\//, "")}/app</span> on your phone.</p>
        </div>
        <p className="fine ig-note">No app store needed. It works like any app: full screen, its own icon, signed in once.</p>
      </div>
    </div>
  );
}
