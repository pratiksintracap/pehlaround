import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "Terms and privacy", description: "Terms, privacy and disclosures for Before the Bell.", openGraph: { title: "Terms and privacy · Before the Bell", description: "Terms, privacy and disclosures for Before the Bell." } };

export default function Page() {
  return <Html html={content("legal")} />;
}
