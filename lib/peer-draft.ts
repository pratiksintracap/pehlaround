import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiUsage, deals, deskNotes } from "@/db/schema";
import { checkCompare } from "@/lib/peers";
import type { PeerCompare, RoomContent } from "@/lib/types";

// Drafts a deal room's peer comparison: the company's figures come only from its room; listed peers are looked
// up on the web. The draft is kept apart (room.compareDraft) and reaches the room only when the desk saves it.
const MODEL = () => process.env.AI_MODEL || "claude-sonnet-5-5";

const RULES = `You build an investor-facing listed-peer comparison for one company on an Indian pre-IPO deal desk.
Return ONLY one JSON object, no prose, matching this TypeScript type exactly:
{ asOf: string; basis: string;
  companies: { name: string; short: string; ticker?: string; subject?: boolean; mcapCr?: number|null; note?: string }[];  // index 0 = the company in the room (subject: true), then 4-6 listed Indian peers
  metrics: { group: "Scale"|"Growth"|"Profitability"|"Returns"|"Balance sheet"|"Efficiency"|"Valuation"; label: string; unit: "₹ Cr"|"%"|"x"|"days"|""; better: "high"|"low"|"none"; vals: (number|null)[]; note?: string }[]; // 12-18 rows, one value per company
  scatter: { x: string; y: string };  // exact labels of a growth or margin row (x) and a valuation multiple row (y) where the company has values
  dims: { name: string; scores: number[]; why: string }[];   // 7-9 dimensions scored 1-5 for every company: Product / technology, Customers and concentration, Entry barriers, Distribution / reach, Scale of operations, Management and governance, Growth runway, plus sector-specific ones
  matrix: { aspect: string; cells: string[]; edge: "ahead"|"par"|"behind"|"mixed"; why: string }[]; // 8-12 rows, cells <= 90 chars, one per company
  barriers: { name: string; level: 1|2|3; note: string }[];  // 4-7
  stands: { ahead: string[]; behind: string[]; watch: string[]; valuation: string[] };  // valuation: neutral facts on multiples only; never put valuation claims in ahead
  sources: { title: string; url?: string }[] }
Rules: the company's figures come ONLY from the room data given; never invent them, use null. Peers: latest full year (FY to March) and current market cap, verified on the web (screener.in, NSE/BSE, results releases); null if not verified. Factual tone: never say cheap, undervalued, fair, attractive or a buy. Be honest where the company is smaller or weaker. Do not search the web for the company itself by name.`;

export async function draftPeerCompare(dealId: number, by: { id: number; name: string }) {
  const db = await getDb();
  const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!d) throw new Error("Deal not found");
  const r = d.room as RoomContent;
  const room = { company: d.company, sector: d.title, structure: d.category, round: d.roundLabel ?? r.round, roundCr: d.roundCr, preMoney: d.preMoney, peLabel: d.peLabel, listing: d.listingLabel,
    lede: r.lede, why: r.why, snapshot: r.snapshot, financials: r.fin, multiples: r.multiples, pe: r.pe, peersHint: r.peers, risks: r.risks, terms: r.terms, stake: r.stake, listedInfo: d.listed ? d.listedInfo : undefined };
  const client = new Anthropic();
  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: `Today is ${new Date().toISOString().slice(0, 10)}. The room data for the company:\n${JSON.stringify(room)}\n\nBuild the comparison now. Output the JSON object only.` }];
  let input = 0, output = 0, searches = 0, text = "";
  for (let turn = 0; turn < 6; turn++) {
    const msg = await client.messages.create({ model: MODEL(), max_tokens: 16000, system: RULES, messages,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 15, user_location: { type: "approximate", country: "IN", timezone: "Asia/Kolkata" } }] });
    input += msg.usage.input_tokens; output += msg.usage.output_tokens;
    searches += (msg.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
    text = msg.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("");
    if (msg.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: msg.content }); continue; }
    break;
  }
  await db.insert(aiUsage).values({ userId: by.id, inputTokens: input, outputTokens: output, searches }).catch(() => 0);
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let c: PeerCompare;
  try { c = checkCompare(JSON.parse(json)); } catch (e) { throw new Error(`The draft did not come back in the right shape (${(e as Error).message}). Try again.`); }
  // never let a valuation claim sit in "ahead"
  const val = /P\/E|EV\/|price ?\/ ?(book|sales)|valuation|multiple|cheap|discount/i;
  c.stands.valuation = [...(c.stands.valuation ?? []), ...c.stands.ahead.filter((t) => val.test(t))];
  c.stands.ahead = c.stands.ahead.filter((t) => !val.test(t));
  const [cur] = await db.select({ room: deals.room }).from(deals).where(eq(deals.id, dealId));
  await db.update(deals).set({ room: { ...(cur.room as RoomContent), compareDraft: c } }).where(eq(deals.id, dealId));
  await db.insert(deskNotes).values({ dealId, body: `Peer comparison drafted by the AI analyst against ${c.companies.length - 1} listed peers (${c.companies.slice(1).map((x) => x.short).join(", ")}). It is a draft: review it in the console's Peer comparison box and save the deal to put it in the room.`, userId: by.id, who: `${by.name} (AI draft)` });
  return c;
}
