// Server-side HTML for pieces that sit inside static content (the home page shelf) as well as React pages.
import type { Deal } from "@/lib/deals";
import { trackerCounts } from "@/lib/deals";

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

export function dotsHtml(d: Deal) {
  const c = trackerCounts(d);
  const dots = d.room.checks.map((k) => `<i class="${k.status}"></i>`).join("");
  return `<div class="dil" aria-label="Diligence status, visible to everyone"><span class="dots">${dots}</span><span><b>${c.done}</b> checks done · <b>${d.publicRisks.length}</b> risks flagged</span></div>`;
}

const SAVE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10v14l-5-3.5L5 17z"></path></svg>';

export function cardHtml(d: Deal, i: number, signed: boolean, registered = false) {
  const acts = !d.open
    ? `<span class="btn" aria-disabled="true">Not open</span><a class="btn" href="/deals/${d.slug}">Overview</a>`
    : signed
      ? `<a class="btn primary" href="/room/${d.slug}">Open room</a><a class="btn" href="/deals/${d.slug}">Overview</a>`
      : `<a class="btn primary" href="/room/${d.slug}"><span class="lock">Unlock room</span></a><a class="btn" href="/deals/${d.slug}">Overview</a>`;
  return `<article class="card rv" style="--d:${(i * 0.06).toFixed(2)}s" data-cat="${esc(d.category)}" data-ticket="${esc(d.minTicket || "")}" data-ipo="${monthsTo(d.listingMonth) ?? 999}"><div style="position:relative"><figure class="deal-art" aria-hidden="true">${d.art || ""}</figure><span class="tag">${esc(d.category)}</span><span class="tag stage${signed ? " liveroom" : ""}">${signed ? "NDA signed" : esc(d.stage)}</span><button type="button" class="save" data-save="${d.slug}" aria-pressed="false" aria-label="Save to shortlist" title="Save to shortlist">${SAVE}</button></div><div class="body"><h3><a href="/deals/${d.slug}">${esc(registered ? d.company : d.title)}</a></h3>${registered ? `<p class="fine" style="margin:-4px 0 6px">${esc(d.title)}</p>` : ""}<p class="hl">${esc(d.headline)}</p><dl class="facts"><div><dt>Target listing</dt><dd class="big">${esc(d.listingLabel)}</dd></div><div><dt>Structure</dt><dd>${esc(d.category)}</dd></div><div><dt>Status</dt><dd>${esc(d.status)}</dd></div><div><dt>Shares</dt><dd>Demat · ISIN active</dd></div></dl>${runwayHtml(d)}${dotsHtml(d)}<div class="acts">${acts}</div></div></article>`;
}

export function shelfHtml(list: Deal[], signed: Set<number>, registered = false) {
  return list.map((d, i) => cardHtml(d, i, signed.has(d.id), registered)).join("");
}
