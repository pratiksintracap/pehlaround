import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";
import { Readiness } from "@/components/Readiness";

const D = "Put your pre-IPO round, secondary or SME-IPO anchor in front of registered family offices and funds. Tell the desk in a minute, or take the free IPO readiness check.";
export const metadata: Metadata = pageMeta({ path: "/founders", title: "List your company", description: D });

export default function Page() {
  return (
    <main>
      <Readiness
        intro={<>
          <span className="eyebrow">For founders and promoters</span>
          <h1 className="tt">Your raise, in front of family offices and funds.<span className="tt2">Tell the desk in a minute.</span></h1>
          <p className="lede" style={{ color: "var(--ink2)" }}>The desk takes a pre-IPO round, a secondary or an SME-IPO anchor to registered family offices and funds, patient capital writing cheques from ₹50 lakh upward. Name, company and a few bands are enough to start; financial statements and documents come after a mutual NDA.</p>
          <ul className="ticks">
            <li>A banker calls within two working days.</li>
            <li>Your round goes only to family offices the desk has approved.</li>
            <li>Nothing is shared with anyone until you agree what goes in the room.</li>
          </ul>
        </>}
        form={<Html as="div" html={content("founders")} />}
      />
    </main>
  );
}
