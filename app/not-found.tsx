import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="wrap nf">
      <span className="eyebrow">404</span>
      <h1>This page is not on the desk.</h1>
      <p className="lede">The address may be mistyped, or the page may have moved. The deals and the desk&apos;s articles are a click away.</p>
      <div className="ctas"><a className="btn primary" href="/deals">See the deals</a><a className="btn" href="/articles">Read the articles</a><a className="btn ghost" href="/">Home</a></div>
    </main>
  );
}
