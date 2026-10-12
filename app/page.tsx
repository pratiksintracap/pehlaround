import { content } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { listDeals, signedDealIds } from "@/lib/deals";
import { shelfHtml } from "@/lib/render";
import { Html } from "@/components/Chrome";

export default async function Home() {
  const [user, deals] = await Promise.all([getUser(), listDeals()]);
  const signed = await signedDealIds(user?.officeId);
  const html = content("home").replace("<!--SHELF-->", shelfHtml(deals, signed, !!user));
  return <Html html={html} />;
}
