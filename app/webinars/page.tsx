import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = pageMeta({ path: "/webinars", title: "Promoter webinars", description: "Weekly sessions where promoters of pre-IPO companies on the desk present to registered investors and take their questions." });

export default function Page() {
  return <Html html={content("webinars")} />;
}
