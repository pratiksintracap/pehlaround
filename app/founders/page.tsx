import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { content } from "@/lib/content";
import { Html } from "@/components/Chrome";
import { Readiness } from "@/components/Readiness";

const D = "Put your pre-IPO round or secondary in front of registered family offices, funds and investors. The desk approves the company and commits its own capital before the round opens. Tell the desk in a minute, or take the free IPO readiness check.";
export const metadata: Metadata = pageMeta({ path: "/founders", title: "List your company", description: D });

export default function Page() {
  return (
    <main>
      <Readiness
        intro={<>
          <span className="eyebrow">For founders and promoters</span>
          <h1 className="tt">Your raise, in front of family offices and funds.<span className="tt2">Tell the desk in a minute.</span></h1>
          <p className="lede" style={{ color: "var(--ink2)" }}>The desk takes a pre-IPO round or a secondary to its registered investors: family offices, funds and qualified individuals, patient capital writing cheques from ₹50 lakh upward. The desk first approves your company on its own diligence and commits its own capital; only then does the round open to every registered investor on the desk. Name, company and a few bands are enough to start; financial statements and documents come after a mutual NDA.</p>
          <ul className="ticks">
            <li>A banker calls within two working days.</li>
            <li>The desk approves your company and commits its own capital before it opens the round to all registered investors.</li>
            <li>Your round goes only to investors the desk has approved.</li>
            <li>Nothing is shared with anyone until you agree what goes in the room.</li>
          </ul>
        </>}
        form={<Html as="div" html={content("founders")} />}
      />
    </main>
  );
}
