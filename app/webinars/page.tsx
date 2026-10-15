import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "Webinars", description: "Promoter sessions for registered investors.", openGraph: { title: "Webinars · Before the Bell", description: "Promoter sessions for registered investors." } };

export default function Page() {
  return <Html html={content("webinars")} />;
}
