import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COVERAGE, PRESS_CONTACT, BOILERPLATE, FACTS, PRESS_PUBLIC } from "@/lib/press";
import { SITE_URL } from "@/lib/site";

const D = "Press kit for Before the Bell: what the desk is, facts, boilerplate, logos and who to call.";
export const metadata: Metadata = { title: "Press", description: D, openGraph: { title: "Press · Before the Bell", description: D } };
const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

export default function Press() {
  if (!PRESS_PUBLIC) notFound();
  if (!PRESS_PUBLIC) notFound();
  return (
    <main>
      <div className="wrap phead"><span className="eyebrow">Press</span>
        <h1 className="tt">For journalists.<span className="tt2">What the desk is, in your words or ours.</span></h1>
        <p>Before the Bell is a pre-IPO deal desk for family offices, funds and qualified investors, operated by SintraCap Advisors in Mumbai. Everything on this page can be quoted. For anything else, write to {PRESS_CONTACT.name} at <a href={`mailto:${PRESS_CONTACT.email}`}>{PRESS_CONTACT.email}</a>; replies within a working day.</p></div>
      <section className="sec tight"><div className="wrap">
        {COVERAGE.length > 0 && <>
          <h2 className="ab-h" style={{ marginTop: 0 }}>In the press</h2>
          <ul className="feed press-list">{COVERAGE.map((c) => (
            <li key={c.url}><span className="mono">{fmt(c.date)}</span><a href={c.url} target="_blank" rel="noopener"><b>{c.outlet}</b> · {c.title}</a></li>))}</ul>
        </>}
        <h2 className="ab-h" style={COVERAGE.length ? undefined : { marginTop: 0 }}>Facts</h2>
        <dl className="press-facts">{FACTS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <h2 className="ab-h">Boilerplate</h2>
        <div className="press-boiler"><p><b>Short.</b> {BOILERPLATE.short}</p><p><b>Long.</b> {BOILERPLATE.long}</p></div>
        <h2 className="ab-h">Spokesperson</h2>
        <p><b>{PRESS_CONTACT.name}</b>, {PRESS_CONTACT.role}. Available for comment on pre-IPO rounds, the IPO calendar, private-market pricing against listed peers, and how family offices and funds approach unlisted companies. <a href={`mailto:${PRESS_CONTACT.email}`}>{PRESS_CONTACT.email}</a>.</p>
        <h2 className="ab-h">Logos and images</h2>
        <ul className="ticks press-assets">
          <li><a href="/icon-512.png" download>Mark, navy tile, 512 px PNG</a></li>
          <li><a href="/og.jpg" download>Banner with wordmark, 1200 × 630 JPG</a></li>
          <li>Name: <b>Before the Bell</b>, three words, capital B on Before and Bell. Colours: navy #0B1730, signal green #2ED39A.</li>
        </ul>
        <h2 className="ab-h">What we ask</h2>
        <p className="fine" style={{ maxWidth: 720 }}>Companies on the desk are shown to approved investors under NDA, so we do not name them, their valuations or their round sizes to the press before they list or announce. We are happy to talk about the market, the model and the numbers on the public pages. Nothing on {SITE_URL.replace(/^https?:\/\//, "")} is an offer or investment advice.</p>
      </div></section>
    </main>
  );
}
