import type { Metadata } from "next";
import { pageMeta, faqLd, crumbsLd, ld } from "@/lib/seo";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = pageMeta({ path: "/how-it-works", title: "How pre-IPO investing works on the desk", description: "How an investor gets from first look to allotment in a pre-IPO round: registration, the NDA, the deal room, promoter calls, documents and the shares in your demat." });

export default function Page() {
  const html = content("how-it-works");
  const faq = faqLd(html);
  return <><Html html={html} />{faq && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />}
    <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd([["Home", "/"], ["How it works", "/how-it-works"]]))} /></>;
}
