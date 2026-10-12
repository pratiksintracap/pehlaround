import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";

export const metadata: Metadata = { title: "List your company", description: "Raising before an IPO? Put your round in front of family offices already on the desk.", openGraph: { title: "List your company · Pehla Round", description: "Raising before an IPO? Put your round in front of family offices already on the desk." } };

export default function Page() {
  return <Html html={content("founders")} />;
}
