import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, documents } from "@/db/schema";
import ART from "@/lib/deal-art.json";

// Read-only: everything the desk would check before calling a live deal complete. Returns what is filled, what is
// empty, and short previews, so the assistant can verify a deal without the console.
const size = (v: unknown): string => {
  if (v == null || v === "") return "EMPTY";
  if (Array.isArray(v)) return v.length ? `${v.length} items` : "EMPTY (0 items)";
  if (typeof v === "object") { const k = Object.keys(v as object).filter((x) => (v as Record<string, unknown>)[x] != null && (v as Record<string, unknown>)[x] !== ""); return k.length ? `{${k.join(", ")}}` : "EMPTY {}"; }
  const t = String(v); return t.length > 160 ? t.slice(0, 160) + "…" : t;
};

export async function dealCheck(name: string) {
  const db = await getDb();
  const n = name.toLowerCase();
  const all = await db.select().from(deals);
  const hits = all.filter((d) => d.company.toLowerCase().includes(n) || d.slug.includes(n));
  if (hits.length !== 1) return { error: hits.length ? `Several match: ${hits.map((d) => d.company).join(", ")}` : "No deal matches." };
  const d = hits[0];
  const docs = await db.select().from(documents).where(eq(documents.dealId, d.id)).orderBy(asc(documents.sort));
  const artKind = !d.art ? "EMPTY" : d.art.startsWith("<img") ? `uploaded picture (${d.art.match(/deal-art\/(\d+)/)?.[1]})`
    : Object.entries(ART as Record<string, string>).find(([, v]) => v === d.art)?.[0] ? `built-in: ${Object.entries(ART as Record<string, string>).find(([, v]) => v === d.art)![0]}` : "custom SVG";
  const fields = { slug: d.slug, company: d.company, title: d.title, category: d.category, phase: d.phase, status: d.status, published: d.published, open: d.open,
    headline: d.headline, listingLabel: d.listingLabel, listingMonth: d.listingMonth, listingNote: d.listingNote, roundLabel: d.roundLabel, roundCr: d.roundCr,
    preMoney: d.preMoney, peLabel: d.peLabel, minTicket: d.minTicket, score: d.score, scoreParts: d.scoreParts ? Object.keys(d.scoreParts).length + " areas marked" : "EMPTY",
    asOf: d.asOf, ndaVersion: d.ndaVersion, dataRoomUrl: d.dataRoomUrl ? "set" : "EMPTY", art: artKind, sort: d.sort, pipelineStage: (d as Record<string, unknown>).pipelineStage,
    ipo: size(d.ipo), publicRisks: size(d.publicRisks), listed: d.listed, debt: d.debt, ipoOnly: d.ipoOnly };
  const room = Object.fromEntries(Object.entries(d.room ?? {}).map(([k, v]) => [k, size(v)]));
  return { ok: true, fields, room, documents: docs.map((x) => ({ title: x.title, kind: x.kind, status: x.status, audience: x.audience, hasUrl: !!x.url })) };
}
