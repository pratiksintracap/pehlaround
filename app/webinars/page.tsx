import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "Webinars", description: "Promoter sessions for registered family offices.", openGraph: { title: "Webinars · Off Market Desk", description: "Promoter sessions for registered family offices." } };

export default function Page() {
  return <Html html={content("webinars")} />;
}
