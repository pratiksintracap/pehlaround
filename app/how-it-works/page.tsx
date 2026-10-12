import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "How it works", description: "How a family office gets from first look to allotment, and what the desk does before any office sees a company.", openGraph: { title: "How it works · Pehla Round", description: "How a family office gets from first look to allotment, and what the desk does before any office sees a company." } };

export default function Page() {
  return <Html html={content("how-it-works")} />;
}
