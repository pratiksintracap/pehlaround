import { ImageResponse } from "next/og";
import { getDeal } from "@/lib/deals";

// The card WhatsApp, LinkedIn and Google show when a deal overview is shared: the anonymised title and stage,
// never the company's name.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A deal on Before the Bell";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getDeal((await params).slug);
  const title = d && d.published ? d.title : "Pre-IPO deal";
  const meta = d && d.published ? `${d.category} · ${d.stage}` : "Before the Bell";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b1730", color: "#e8edf7", padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#122247", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 26 26" width="32" height="32"><path d="M5.6 18.2V12.4a6.4 6.4 0 0 1 12.8 0v5.8l1.9 2.1H3.7z" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinejoin="round" /><circle cx="12" cy="23.2" r="1.7" fill="#ffffff" /><circle cx="21" cy="5" r="3" fill="#2ed39a" /></svg>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#ffffff" }}>Before the Bell</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#2ed39a" }}>{meta}</div>
          <div style={{ fontSize: title.length > 40 ? 64 : 76, fontWeight: 700, color: "#ffffff", lineHeight: 1.08, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#a9b5d1" }}>
          <span>Vetted before you see it · beforethebell.in</span><span>For registered investors</span>
        </div>
      </div>
    ),
    size,
  );
}
