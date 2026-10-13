export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <main><div className="wrap" style={{ padding: "80px var(--gutter)", maxWidth: 560 }}>
      <span className="eyebrow">Off Market Desk</span>
      <h1 style={{ margin: "12px 0" }}>You are offline</h1>
      <p className="lede">Deal rooms and your dashboard need a connection, so nothing about your office is stored on this device. Reconnect and try again.</p>
      <p><a className="btn primary" href="/dashboard">Try again</a></p>
    </div></main>
  );
}
