import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = pageMeta({ path: "/about", title: "About us", description: "Before the Bell is run by SintraCap, a Mumbai investment bank and family office that invests its own capital in every company it brings to the desk." });

export default function Page() {
  return <Html html={content("about")} />;
}
