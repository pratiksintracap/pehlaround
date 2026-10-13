import { ImageResponse } from "next/og";
import { getArticle } from "@/lib/articles";
import { coverTheme, coverPhoto } from "@/lib/cover-theme";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link-preview image for WhatsApp, LinkedIn and email: the article title on the brand's navy.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArticle((await params).slug);
  const title = a?.title ?? "Pehla Round";
  const th = coverTheme({ slug: a?.slug ?? "x", title });
  const photo = coverPhoto({ slug: a?.slug ?? "x", title, image: a?.image }, 1200, 630);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", color: "#ffffff", fontFamily: "sans-serif", background: th.to }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, objectFit: "cover" }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex",
          background: `linear-gradient(180deg, rgba(5,10,25,0.15) 0%, rgba(5,10,25,0.55) 45%, rgba(5,10,25,0.92) 100%)` }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ffffff", color: "#0b1730", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>1</div>
            <span style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>Pehla Round · From the desk</span>
            <span style={{ marginLeft: 12, background: "#ffffff", color: "#0b1730", borderRadius: 999, padding: "8px 20px", fontSize: 20, fontWeight: 800, letterSpacing: 2, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: th.to, display: "flex" }} />{th.label.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ width: 90, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${th.from}, ${th.to})`, display: "flex" }} />
            <div style={{ fontSize: title.length > 70 ? 52 : 62, lineHeight: 1.12, fontWeight: 700, letterSpacing: -1.5, maxWidth: 1060 }}>{title}</div>
            <div style={{ fontSize: 24, color: "rgba(255,255,255,0.8)" }}>pehlaround.in</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
