import type { Metadata } from "next";
import { pageMeta, videoLd, ld } from "@/lib/seo";
import { content } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { listDeals, signedDealIds, canSeeNames, listUpcoming } from "@/lib/deals";
import { shelfHtml, upcomingHtml } from "@/lib/render";
import { Html } from "@/components/Chrome";
import { listArticles, artDate, artHref } from "@/lib/articles";
import { esc } from "@/lib/render";
import { isDesk } from "@/lib/perm";
import { COVERAGE, PRESS_PUBLIC } from "@/lib/press";

const FILM = `<section class="sec film" id="film"><div class="wrap film-in"><div class="film-copy rv inview"><span class="eyebrow">The desk in under a minute</span><p>What Before the Bell is, how a company reaches the desk, and what an approved investor sees.</p><div class="ctas"><a class="btn primary" href="/register">Register</a><a class="btn" href="/how-it-works">How it works</a></div></div><figure class="film-frame rv inview"><video controls playsinline preload="none" poster="/film/poster.jpg" aria-label="Before the Bell, a 48-second film"><source src="/film/before-the-bell.mp4" type="video/mp4"></video></figure></div></section>`;

export const metadata: Metadata = pageMeta({ path: "/", absoluteTitle: true, title: "Before the Bell · Pre-IPO deals in India’s next listings, vetted",
  description: "Pre-IPO rounds in profitable, IPO-bound Indian companies for family offices, funds and qualified investors. Vetted before you see them; we invest in every one." });

export default async function Home() {
  const [user, deals] = await Promise.all([getUser(), listDeals()]);
  const signed = await signedDealIds(user?.officeId);
  const arts = await listArticles(10);
  const items = arts.map((a) => `<li><span class="mono">${esc(artDate(a.publishedAt))}</span><a class="feedart" href="${esc(artHref(a))}"${a.externalUrl ? ' target="_blank" rel="noopener"' : ""}>${esc(a.title)}</a></li>`).join("");
  const upcoming = await listUpcoming();
  let html = content("home").replace("<!--SHELF-->", shelfHtml(deals, signed, await canSeeNames(user)))
    .replace('<section class="sec why" id="why">', upcomingHtml(upcoming, !!user) + (user ? FILM.replace('<a class="btn primary" href="/register">Register</a>', '<a class="btn primary" href="/deals">See the deals</a>') : FILM) + '<section class="sec why" id="why">').replace("<!--NEWS-->", items + items);
  // members get their dashboard, not a register button, in the hero
  if (user) html = html.replace('<div class="ctas"><a class="btn primary" href="/register">Register</a>', `<div class="ctas"><a class="btn primary" href="${isDesk(user) ? "/admin" : "/dashboard"}">${isDesk(user) ? "Open the admin" : "Open your dashboard"}</a>`);
  // "As featured in" after the hero, only once there is coverage to show (see lib/press.ts).
  if (PRESS_PUBLIC && COVERAGE.length) html = html.replace("</section>", `</section><section class="press-strip"><div class="wrap"><span class="k">As featured in</span>${COVERAGE.slice(0, 6).map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.outlet)}</a>`).join("")}</div></section>`);
  return <><Html html={html} /><script type="application/ld+json" dangerouslySetInnerHTML={ld(videoLd())} /></>;
}
