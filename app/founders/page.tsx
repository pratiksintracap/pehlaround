import type { Metadata } from "next";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";
import { Readiness } from "@/components/Readiness";

const D = "Free IPO readiness check: SME or main board, what to fix first and an indicative value at listing. Then put your pre-IPO round in front of family offices.";
export const metadata: Metadata = { title: "List your company", description: D, openGraph: { title: "List your company · Off Market Desk", description: D } };

export default function Page() {
  return (
    <main>
      <Readiness intro={<>
        <span className="eyebrow">For founders and promoters</span>
        <h1 className="tt">Your raise, in front of family offices.<span className="tt2">Start by checking you are ready to list.</span></h1>
        <p className="lede" style={{ color: "var(--ink2)" }}>The desk takes a pre-IPO round, a secondary or an SME-IPO anchor to registered family offices, patient capital writing cheques from ₹50 lakh upward.</p>
        <ul className="ticks">
          <li>Main board or SME: which tests your numbers clear today.</li>
          <li>An indicative value at listing against listed peers.</li>
          <li>What to fix first, and a timeline to listing.</li>
        </ul>
      </>} />
      <Html as="div" html={content("founders")} />
    </main>
  );
}
