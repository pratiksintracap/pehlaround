import { ImageResponse } from "next/og";
import { getArticle } from "@/lib/articles";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link-preview image for WhatsApp, LinkedIn and email: the article title on the brand's navy.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArticle((await params).slug);
  const title = a?.title ?? "Pehla Round";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72,
        background: "radial-gradient(circle at 15% 0%, #1b2d5c 0%, #070d19 70%)", color: "#eef2fa", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#eef2fa", color: "#0b1730", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>1</div>
          <span>Pehla Round · From the desk</span>
        </div>
        <div style={{ fontSize: title.length > 70 ? 54 : 64, lineHeight: 1.12, fontWeight: 700, letterSpacing: -1.5, maxWidth: 1000 }}>{title}</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
          {[60, 90, 75, 120, 105, 150, 140, 190].map((h, i) => <div key={i} style={{ width: 34, height: h, borderRadius: 6, background: i === 7 ? "#2ed39a" : "#5b7cff" }} />)}
          <span style={{ marginLeft: 24, fontSize: 26, color: "#a9b5d1" }}>pehlaround.in</span>
        </div>
      </div>
    ),
    size,
  );
}
