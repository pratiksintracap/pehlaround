// Article cover: an editorial photograph (the desk's own image when it set one), with the
// subject's colour label on top so the list reads at a glance.
import { coverPhoto, coverTheme } from "@/lib/cover-theme";

type A = { slug: string; title: string; image?: string | null };

export function Cover({ a, className = "", hero = false }: { a: A; className?: string; hero?: boolean }) {
  const th = coverTheme(a);
  const src = coverPhoto(a, hero ? 1600 : 800, hero ? 840 : 420);
  return (
    <div className={`cover photo ${className}`} style={{ ["--from" as string]: th.from, ["--to" as string]: th.to }}>
      <img src={src} alt="" loading={hero ? "eager" : "lazy"} decoding="async" />
      <span className="cover-tint" aria-hidden="true" />
      <span className="cover-chip"><i style={{ background: th.to }} />{th.label}</span>
      {hero && !a.image && <span className="cover-credit">Photo: Unsplash</span>}
    </div>
  );
}
