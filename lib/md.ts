import { esc } from "@/lib/render";

/** Minimal formatting for articles: blank-line paragraphs, "## " headings, "- " bullets, **bold**, [text](url). */
export function md(src: string) {
  const inline = (t: string) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return src.split(/\n\s*\n/).map((block) => {
    const b = block.trim();
    if (!b) return "";
    if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
    const lines = b.split("\n");
    if (lines.every((l) => l.trim().startsWith("- "))) return `<ul>${lines.map((l) => `<li>${inline(l.trim().slice(2))}</li>`).join("")}</ul>`;
    return `<p>${inline(b).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}
