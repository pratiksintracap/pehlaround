import "server-only";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { NDA_CLAUSES, ndaParties } from "@/lib/nda";

export type NdaRecord = {
  id: number; company: string; officeName: string; entityName: string | null;
  signerName: string; signerEmail: string; codeVerified: boolean; version: string; signedAt: Date; ip: string | null;
};

const NAVY = rgb(0.043, 0.09, 0.188), INK2 = rgb(0.23, 0.27, 0.39), INK3 = rgb(0.42, 0.46, 0.56), ACCENT = rgb(0.12, 0.31, 1);

// Standard PDF fonts only carry Latin characters; swap anything else for a safe equivalent.
const safe = (s: string) => s.replace(/₹/g, "Rs ").replace(/[^\x20-\x7E -ÿ‘’“”–—•]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = []; let line = "";
  for (const w of safe(text).split(/\s+/)) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** A fingerprint of what was signed, printed on the PDF so a copy can be checked against the desk's record. */
export const ndaFingerprint = (r: NdaRecord) =>
  createHash("sha256").update([r.id, r.company, r.officeName, r.entityName, r.signerName, r.signerEmail, r.version, r.signedAt.toISOString(), r.ip].join("|")).digest("hex");

export async function ndaPdf(r: NdaRecord): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`NDA – ${r.company} – ${r.officeName}`); pdf.setAuthor("Before the Bell"); pdf.setCreator("Before the Bell");
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const W = 595.28, H = 841.89, M = 56, CW = W - 2 * M;
  let page = pdf.addPage([W, H]); let y = H - M;
  const need = (h: number) => { if (y - h < M + 30) { page = pdf.addPage([W, H]); y = H - M; } };
  const para = (text: string, font = reg, size = 10.5, color = INK2, gap = 6, indent = 0) => {
    for (const l of wrap(text, font, size, CW - indent)) { need(size + 4); page.drawText(l, { x: M + indent, y, size, font, color }); y -= size + 4; }
    y -= gap;
  };
  // header
  page.drawRectangle({ x: M, y: y - 4, width: 22, height: 22, color: NAVY });
  { // the bell mark, drawn in the mark's 26-unit grid scaled to the 22pt tile
    const k = 22 / 26, top = y + 18;
    page.drawSvgPath("M5.6 18.2V12.4a6.4 6.4 0 0 1 12.8 0v5.8l1.9 2.1H3.7z", { x: M, y: top, scale: k, borderColor: rgb(1, 1, 1), borderWidth: 1.9 });
    page.drawCircle({ x: M + 12 * k, y: top - 23.2 * k, size: 1.7 * k, color: rgb(1, 1, 1) });
    page.drawCircle({ x: M + 21 * k, y: top - 5 * k, size: 3 * k, color: rgb(0.18, 0.83, 0.6) });
  }
  page.drawText("Before the Bell", { x: M + 30, y: y + 2, size: 13, font: bold, color: NAVY });
  page.drawText("Signed non-disclosure agreement", { x: W - M - bold.widthOfTextAtSize("Signed non-disclosure agreement", 9), y: y + 4, size: 9, font: bold, color: INK3 });
  y -= 34;
  para(`${r.company}`, bold, 18, NAVY, 2);
  para(`and ${r.officeName}${r.entityName ? ` (${r.entityName})` : ""}`, reg, 12, INK2, 14);
  para(ndaParties(r.company, r.entityName ? `${r.officeName} (${r.entityName})` : r.officeName, r.version), reg, 10.5, INK2, 10);
  NDA_CLAUSES.forEach(([t, b], i) => {
    need(30);
    page.drawText(`${i + 1}.`, { x: M, y, size: 10.5, font: bold, color: NAVY });
    const lines = wrap(`${t} ${b}`, reg, 10.5, CW - 18);
    lines.forEach((l, j) => {
      need(15);
      if (j === 0) { const tw = bold.widthOfTextAtSize(safe(t), 10.5); page.drawText(safe(t), { x: M + 18, y, size: 10.5, font: bold, color: NAVY }); page.drawText(l.slice(safe(t).length), { x: M + 18 + tw, y, size: 10.5, font: reg, color: INK2 }); }
      else page.drawText(l, { x: M + 18, y, size: 10.5, font: reg, color: INK2 });
      y -= 14.5;
    });
    y -= 6;
  });
  // signature block
  need(170); y -= 10;
  page.drawRectangle({ x: M, y: y - 150, width: CW, height: 156, borderColor: rgb(0.85, 0.87, 0.92), borderWidth: 1, color: rgb(0.975, 0.98, 0.99) });
  let sy = y - 16;
  page.drawText("SIGNED FOR THE OFFICE", { x: M + 16, y: sy, size: 8.5, font: bold, color: INK3 }); sy -= 30;
  page.drawText(safe(r.signerName), { x: M + 16, y: sy, size: 22, font: ital, color: ACCENT }); sy -= 8;
  page.drawLine({ start: { x: M + 16, y: sy }, end: { x: M + 260, y: sy }, thickness: 0.8, color: INK3 }); sy -= 14;
  const at = r.signedAt.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "medium", timeZone: "Asia/Kolkata" });
  const rows: [string, string][] = [
    ["Signed by", `${r.signerName} (${r.signerEmail}), for ${r.officeName}`],
    ["Email check", r.codeVerified ? `One-time code sent to ${r.signerEmail} and entered at signing` : "Signed on screen while signed in to the office's account"],
    ["Signed at", `${at} IST`], ["Recorded from", r.ip || "—"], ["Agreement", `Version ${r.version} · record #${r.id}`],
  ];
  for (const [k, v] of rows) { page.drawText(k, { x: M + 16, y: sy, size: 9, font: bold, color: INK3 }); page.drawText(safe(v).slice(0, 95), { x: M + 120, y: sy, size: 9, font: reg, color: INK2 }); sy -= 13; }
  y -= 168;
  para(`Executed electronically on Before the Bell: the signatory, signed in to the office's account, typed their name, confirmed the agreement on screen${r.codeVerified ? " and entered a one-time code emailed to their address" : ""}. Record fingerprint (SHA-256): ${ndaFingerprint(r)}`, reg, 8, INK3, 0);
  // footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`Before the Bell · operated by SintraCap Advisors LLP · Confidential · Page ${i + 1} of ${pages.length}`, { x: M, y: 28, size: 7.5, font: reg, color: INK3 }));
  return pdf.save();
}
