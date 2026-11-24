import "server-only";
// The deal pipeline as an A4 landscape PDF (Deal pipeline → Export PDF): deals grouped by the desk's stage, each with
// its book, owner, terms, who is interested, the next task and the latest desk note. Desk only.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { DeskDeal } from "@/lib/desk";
import { ACTIVE_STAGES, DEAL_STAGES } from "@/lib/stages";
import { interestLabel, isWarm, who, type Interest } from "@/lib/deal-interest";

type Opts = {
  owners: Map<number, string>; open: { dealId: number | null; title: string; dueOn: string | null }[]; interest: Map<number, Interest[]>;
  lastAt: Map<number | null, Date>; latestNote: Map<number, { body: string; at: Date }>; today: string; filters: string;
};
const safe = (s: string) => s.replace(/₹/g, "Rs ").replace(/→/g, "->").replace(/[^\x20-\x7E -ÿ‘’“”–—•]/g, "");
function wrap(text: string, font: PDFFont, size: number, width: number, max = 99) {
  const out: string[] = []; let line = "";
  for (const w of safe(text).split(/\s+/).filter(Boolean)) { const t = line ? `${line} ${w}` : w; if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, "") + " …"; }
  return out;
}
const ist = (d: Date) => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);

export async function pipelinePdf(list: DeskDeal[], o: Opts) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Deal pipeline ${o.today}`); doc.setAuthor("Before the Bell desk");
  const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 36, CW = W - 2 * M;
  const NAVY = rgb(0.043, 0.09, 0.19), INK2 = rgb(0.23, 0.27, 0.39), INK3 = rgb(0.42, 0.46, 0.56), BLUE = rgb(0.12, 0.31, 1), RULE = rgb(0.86, 0.88, 0.92), RED = rgb(0.75, 0.22, 0.17);
  // Columns: deal | book & terms | owner & since | interest | next task | latest note
  const cols = [{ x: 0, w: 150 }, { x: 156, w: 130 }, { x: 292, w: 82 }, { x: 380, w: 150 }, { x: 536, w: 120 }, { x: 662, w: CW - 662 }];
  const heads = ["Deal", "Book · terms", "Owner · in stage since", "Interest", "Next task", "Latest desk note"];
  let page = doc.addPage([W, H]); let y = H - M; let pageNo = 1;
  const header = () => {
    page.drawText("Before the Bell", { x: M, y: y - 12, size: 12, font: bold, color: NAVY });
    const t = safe(`Deal pipeline · ${o.today}${o.filters ? ` · ${o.filters}` : ""} · ${list.length} deals`);
    page.drawText(t, { x: W - M - reg.widthOfTextAtSize(t, 8.5), y: y - 10, size: 8.5, font: reg, color: INK3 });
    y -= 20; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: RULE }); y -= 12;
    heads.forEach((h, i) => page.drawText(h.toUpperCase(), { x: M + cols[i].x, y: y - 7, size: 6.5, font: bold, color: INK3 }));
    y -= 14;
  };
  const newPage = () => { page.drawText(`Page ${pageNo} · desk only, not for circulation`, { x: M, y: 18, size: 7, font: reg, color: INK3 }); page = doc.addPage([W, H]); pageNo++; y = H - M; header(); };
  header();
  const stages = list.some((d) => d.pipelineStage === "archived") ? DEAL_STAGES : ACTIVE_STAGES;
  for (const st of stages) {
    const ds = list.filter((d) => d.pipelineStage === st.id);
    if (!ds.length) continue;
    if (y < M + 60) newPage();
    y -= 4; page.drawText(safe(`${st.label} · ${ds.length}`), { x: M, y: y - 10, size: 10.5, font: bold, color: BLUE }); y -= 15;
    for (const d of ds) {
      const info = (d.debtInfo ?? {}) as Record<string, unknown>;
      const book = d.listed ? "After the Bell" : d.debt ? "Debt" : "Before the Bell";
      const terms = d.debt ? [info.facility, info.amountCr ? `Rs ${info.amountCr} Cr` : "", info.rateBand, info.tenorMonths ? `${info.tenorMonths} months` : ""].filter(Boolean).join(" · ")
        : [d.category, d.roundCr ? `Rs ${d.roundCr} Cr round` : "", d.preMoney ? `pre-money ${d.preMoney}` : ""].filter(Boolean).join(" · ");
      const t = o.open.filter((x) => x.dealId === d.id).sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
      const late = t.filter((x) => x.dueOn && x.dueOn < o.today).length;
      const l = o.interest.get(d.id) ?? [];
      const warm = l.filter((x) => isWarm(x.status)), pitched = l.filter((x) => x.status === "pitched"), passed = l.filter((x) => x.status === "passed");
      const intr = [warm.map((x) => `${who(x)} (${interestLabel(x.status)}${x.amountCr ? `, Rs ${x.amountCr} Cr` : ""})`).join("; "), pitched.length ? `Pitched: ${pitched.map(who).join(", ")}` : "", passed.length ? `Passed: ${passed.map(who).join(", ")}` : ""].filter(Boolean).join(". ") || "—";
      const n = o.latestNote.get(d.id);
      const last = o.lastAt.get(d.id);
      const cells: { lines: string[]; font?: PDFFont; color?: ReturnType<typeof rgb> }[] = [
        { lines: [...wrap(d.company, bold, 8.5, cols[0].w, 2), ...wrap(d.published ? "On the site" : d.listed || d.debt ? "Desk only" : "Not on the site", reg, 7, cols[0].w, 1)], font: bold },
        { lines: wrap(`${book}${terms ? ` · ${terms}` : ""}`, reg, 7.5, cols[1].w, 4) },
        { lines: wrap(`${o.owners.get(d.id) || "No owner"}${d.stageAt ? ` · since ${ist(d.stageAt)}` : ""}${last ? ` · last activity ${ist(last)}` : ""}`, reg, 7.5, cols[2].w, 4) },
        { lines: wrap(intr, reg, 7.5, cols[3].w, 5) },
        { lines: wrap(t.length ? `${t[0].title}${t[0].dueOn ? ` (due ${t[0].dueOn})` : ""}${t.length > 1 ? ` · ${t.length} open` : ""}${late ? ` · ${late} overdue` : ""}` : "—", reg, 7.5, cols[4].w, 4), color: late ? RED : undefined },
        { lines: wrap(n ? `${ist(n.at)}: ${n.body}` : "—", reg, 7.5, cols[5].w, 4) },
      ];
      const h = Math.max(...cells.map((c) => c.lines.length)) * 9.5 + 6;
      if (y - h < M + 14) newPage();
      cells.forEach((c, i) => c.lines.forEach((ln, j) => page.drawText(ln, { x: M + cols[i].x, y: y - 8 - j * 9.5, size: i === 0 && j < 2 && c.font === bold ? 8.5 : 7.5, font: i === 0 && c.font === bold && !/^(On the site|Desk only|Not on the site)$/.test(ln) ? bold : reg, color: c.color ?? (i === 0 ? NAVY : INK2) })));
      y -= h; page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.4, color: RULE });
    }
    y -= 6;
  }
  page.drawText(`Page ${pageNo} · desk only, not for circulation`, { x: M, y: 18, size: 7, font: reg, color: INK3 });
  return doc.save();
}
