import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "About us", description: "Pehla Round is run by SintraCap Advisors LLP, a Mumbai family office and investment bank.", openGraph: { title: "About us · Pehla Round", description: "Pehla Round is run by SintraCap Advisors LLP, a Mumbai family office and investment bank." } };

export default function Page() {
  return <Html html={content("about")} />;
}
