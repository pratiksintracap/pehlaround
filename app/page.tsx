import { content } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { listDeals, signedDealIds, canSeeNames } from "@/lib/deals";
import { shelfHtml } from "@/lib/render";
import { Html } from "@/components/Chrome";
import { listArticles, artDate, artHref } from "@/lib/articles";
import { esc } from "@/lib/render";

export default async function Home() {
  const [user, deals] = await Promise.all([getUser(), listDeals()]);
  const signed = await signedDealIds(user?.officeId);
  const arts = await listArticles(10);
  const items = arts.map((a) => `<li><span class="mono">${esc(artDate(a.publishedAt))}</span><a class="feedart" href="${esc(artHref(a))}"${a.externalUrl ? ' target="_blank" rel="noopener"' : ""}>${esc(a.title)}</a></li>`).join("");
  let html = content("home").replace("<!--SHELF-->", shelfHtml(deals, signed, await canSeeNames(user))).replace("<!--NEWS-->", items + items);
  // members get their dashboard, not a register button, in the hero
  if (user) html = html.replace('<div class="ctas"><a class="btn primary" href="/register">Register</a></div>', `<div class="ctas"><a class="btn primary" href="${user.role === "admin" ? "/admin" : "/dashboard"}">${user.role === "admin" ? "Open the admin" : "Open your dashboard"}</a></div>`);
  return <Html html={html} />;
}
