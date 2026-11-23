import type { Metadata } from "next";
import "./credit.css";

// The private-credit console: confidential, so no indexing and no link previews.
export const metadata: Metadata = {
  title: "Private credit",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

// Every page depends on the signed-in user; never statically render or cache.
export const dynamic = "force-dynamic";

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return <div className="credit-app">{children}</div>;
}
