import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "About us", description: "Pehla Round is backed by SintraCap, a family office that invests its own capital in listed and pre-IPO companies.", openGraph: { title: "About us · Pehla Round", description: "Pehla Round is backed by SintraCap, a family office that invests its own capital in listed and pre-IPO companies." } };

export default function Page() {
  return <Html html={content("about")} />;
}
