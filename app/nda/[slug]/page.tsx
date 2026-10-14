import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "NDA", robots: { index: false } };
type P = { params: Promise<{ slug: string }> };

/** The NDA is signed on the deal's own page now; older links (emails, notifications) land there. */
export default async function Nda({ params }: P) {
  const { slug } = await params;
  const user = await getUser();
  if (!user) redirect(`/register?next=${encodeURIComponent(`/deals/${slug}#sign`)}`);
  redirect(`/deals/${slug}#sign`);
}
