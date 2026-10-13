import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "Terms and privacy", description: "Terms, privacy and disclosures for Off Market Desk.", openGraph: { title: "Terms and privacy · Off Market Desk", description: "Terms, privacy and disclosures for Off Market Desk." } };

export default function Page() {
  return <Html html={content("legal")} />;
}
