import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = pageMeta({ path: "/legal", title: "Terms and privacy", description: "Terms, privacy and disclosures for Before the Bell." });

export default function Page() {
  return <Html html={content("legal")} />;
}
