import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "Terms and privacy", description: "Terms, privacy and disclosures for Pehla Round.", openGraph: { title: "Terms and privacy · Pehla Round", description: "Terms, privacy and disclosures for Pehla Round." } };

export default function Page() {
  return <Html html={content("legal")} />;
}
