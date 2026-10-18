// Server-side HTML for pieces that sit inside static content (the home page shelf) as well as React pages.
import type { Deal } from "@/lib/deals";

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function monthsTo(ym: string | null | undefined, now = new Date()) {
  if (!ym) return null;
  const [y, m] = ym.split("-").map(Number);
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
}

export function runwaySvg(d: Pick<Deal, "listingMonth">) {
  const mo = monthsTo(d.listingMonth);
  if (mo == null) {
    return '<svg class="viz" viewBox="0 0 300 26" preserveAspectRatio="none" aria-hidden="true"><line class="axis dashed" x1="6" x2="294" y1="13" y2="13"></line><circle class="c2" cx="6" cy="13" r="4"></circle></svg>';
  }
  const p = Math.min(0.96, Math.max(0.04, 1 - mo / 48));
  const x2 = 6 + 288 * p;
  return `<svg class="viz" viewBox="0 0 300 26" preserveAspectRatio="none" aria-hidden="true"><line class="axis" x1="6" x2="294" y1="13" y2="13"></line><line class="c2s" x1="6" x2="${x2.toFixed(1)}" y1="13" y2="13" stroke-width="3"></line><circle class="c2" cx="6" cy="13" r="4"></circle><path class="flag c1" d="M292 4 v18 M292 4 h8 l-3 4 3 4 h-8" fill="none"></path></svg>`;
}

export function runwayHtml(d: Deal) {
  if (!d.listingMonth) {
    return `<div class="runway none">${runwaySvg(d)}<div class="k"><span>${esc(d.category)}</span><span>Listing not yet scheduled</span></div></div>`;
  }
  return `<div class="runway" aria-label="Target listing ${esc(d.listingLabel)}">${runwaySvg(d)}<div class="k"><span>Today</span><span>Target listing · <b>${esc(d.listingLabel)}</b></span></div></div>`;
}

export const SCORE_NOTE = "Before the Bell's proprietary score for how well a company suits a pre-IPO investment, drawing on its earnings, entry price against listed peers, path to listing, governance and the round itself. Only companies that clear the desk's bar are listed. It is not a rating of the shares or a recommendation.";

/** Ring showing the Desk Score out of 10. */
export function scoreSvg(score: number, px = 44) {
  const C = 2 * Math.PI * 20, a = Math.max(0, Math.min(10, score)) / 10 * C;
  return `<svg class="viz sring" viewBox="0 0 48 48" width="${px}" height="${px}" style="width:${px}px;height:${px}px;flex:none" aria-hidden="true"><circle class="track" cx="24" cy="24" r="20" fill="none" stroke-width="4"></circle><circle class="arc" cx="24" cy="24" r="20" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="${a.toFixed(2)} ${(C - a).toFixed(2)}" transform="rotate(-90 24 24)"></circle><text x="24" y="28.5" text-anchor="middle">${score.toFixed(1)}</text></svg>`;
}

/** The score line on a deal card (replaces the old checks and risks counts). */
export function scoreHtml(d: Pick<Deal, "score">) {
  if (d.score == null) return `<div class="pscore none"><span class="pk">Desk Score</span><span class="ps">Assessment in progress</span></div>`;
  return `<div class="pscore" title="${esc(SCORE_NOTE)}">${scoreSvg(d.score)}<div><span class="pk">Desk Score</span><span class="ps"><b>${d.score.toFixed(1)}</b> / 10 · proprietary</span></div></div>`;
}

const SAVE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10v14l-5-3.5L5 17z"></path></svg>';

export function cardHtml(d: Deal, i: number, signed: boolean, registered = false) {
  const acts = !d.open
    ? `<span class="btn" aria-disabled="true">Not open</span><a class="btn" href="/deals/${d.slug}">Overview</a>`
    : signed
      ? `<a class="btn primary" href="/room/${d.slug}">Open room</a><a class="btn" href="/deals/${d.slug}">Overview</a>`
      : `<a class="btn primary" href="/room/${d.slug}"><span class="lock">Unlock room</span></a><a class="btn" href="/deals/${d.slug}">Overview</a>`;
  return `<article class="card rv" style="--d:${(i * 0.06).toFixed(2)}s" data-cat="${esc(d.category)}" data-ticket="${esc(d.minTicket || "")}" data-ipo="${monthsTo(d.listingMonth) ?? 999}" data-score="${d.score ?? ""}"><div style="position:relative"><figure class="deal-art" aria-hidden="true">${d.art || ""}</figure><span class="tag">${esc(d.category)}</span><span class="tag stage${signed ? " liveroom" : ""}">${signed ? "NDA signed" : esc(d.stage)}</span><button type="button" class="save" data-save="${d.slug}" aria-pressed="false" aria-label="Save to shortlist" title="Save to shortlist">${SAVE}</button></div><div class="body"><h3><a href="/deals/${d.slug}">${esc(registered ? d.company : d.title)}</a></h3>${registered ? `<p class="fine" style="margin:-4px 0 6px">${esc(d.title)}</p>` : ""}<p class="hl">${esc(d.headline)}</p><dl class="facts"><div><dt>Target listing</dt><dd class="big">${esc(d.listingLabel)}</dd></div><div><dt>Structure</dt><dd>${esc(d.category)}</dd></div><div><dt>Status</dt><dd>${esc(d.status)}</dd></div><div><dt>Shares</dt><dd>Demat · ISIN active</dd></div></dl>${runwayHtml(d)}${scoreHtml(d)}<div class="acts">${acts}</div></div></article>`;
}

/** A compact "on the desk now" list for an invited visitor: anonymised title, structure, target listing and score.
 *  Everything here is already public on /deals. */
export function teaserHtml(open: Deal[], coming: number) {
  if (!open.length) return "";
  const rows = open.slice(0, 6).map((d) => `<li><a href="/deals/${d.slug}" target="_blank" rel="noopener"><span class="tz-t">${esc(d.title)}</span><span class="tz-m">${esc(d.category)} · listing ${esc(/20\d\d/.test(d.listingLabel) ? d.listingLabel : "to be set")}</span></a>${d.score != null ? `<span class="tz-s" title="${esc(SCORE_NOTE)}">${d.score.toFixed(1)}<small>/10</small></span>` : ""}</li>`).join("");
  return `<div class="teaser"><span class="tz-h">On the desk now · ${open.length} ${open.length === 1 ? "company" : "companies"}</span><ul>${rows}</ul><p class="fine">Shown here without names. Register and each opens by name, with its round, valuation and pitch deck.${coming ? ` ${coming} more ${coming === 1 ? "is" : "are"} in diligence.` : ""}</p></div>`;
}

/** "Coming to the desk": deals still in preparation, by sector, structure and listing year only. */
export function upcomingHtml(list: Deal[], signedIn: boolean) {
  if (!list.length) return "";
  // The target the desk has set (e.g. "September 2027"); "To be set" until it carries a year.
  const yr = (d: Deal) => (/20\d\d/.test(d.listingLabel) ? d.listingLabel : "To be set");
  const cards = list.map((d) => `<article class="up-card"><figure class="deal-art" aria-hidden="true">${d.art || ""}</figure><div class="up-body"><span class="up-tag">In diligence</span><h3>${esc(d.title)}</h3>${d.headline ? `<p>${esc(d.headline)}</p>` : ""}<dl><div><dt>Structure</dt><dd>${esc(d.category)}</dd></div><div><dt>Target listing</dt><dd>${esc(yr(d))}</dd></div></dl></div></article>`).join("");
  const cta = signedIn ? `<p class="fine up-note">You will be told the day each one opens.</p>` : `<p class="up-note"><a class="btn sm" href="/register">Register to be told when they open</a></p>`;
  return `<section class="sec tight upcoming" id="coming"><div class="wrap"><div class="sec-head rv inview"><div><span class="eyebrow">Coming to the desk</span><h2 class="tt">In diligence now.<span class="tt2">Opening over the coming weeks.</span></h2><p>The desk is still on site with these companies. Each opens here once its diligence is done; until then only the sector and structure are shown.</p></div></div><div class="up-row" tabindex="0" aria-label="Companies coming to the desk">${cards}</div>${cta}</div></section>`;
}

export function shelfHtml(list: Deal[], signed: Set<number>, registered = false) {
  return list.map((d, i) => cardHtml(d, i, signed.has(d.id), registered)).join("");
}
