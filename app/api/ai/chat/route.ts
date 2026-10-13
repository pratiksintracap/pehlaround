import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { aiChats } from "@/db/schema";
import { getDeal, canSeeNames, roomAccess } from "@/lib/deals";
import { getSettings } from "@/lib/settings";
import { readBody, str, jerr } from "@/lib/http";
import { allow, TOO_MANY } from "@/lib/rate";
import { aiReady, context, converse, type Cite } from "@/lib/ai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Who may use the analyst, and in which room. */
async function gate(slug: string) {
  const user = await getUser();
  if (!user) return { err: jerr("Please sign in again.", 401) };
  if (!aiReady() || !(await getSettings()).aiAnalyst) return { err: jerr("The analyst is not switched on.", 503) };
  const names = await canSeeNames(user);
  if (!names) return { err: jerr("The analyst opens once the desk approves your office.", 403) };
  const deal = slug ? await getDeal(slug) : null;
  if (slug && (!deal || (await roomAccess(user, deal)).state !== "open")) return { err: jerr("Sign this company's NDA to ask about it.", 403) };
  return { user, names, deal };
}

/** The person's latest conversation here (this room, or the dashboard). */
export async function GET(req: NextRequest) {
  const g = await gate(str(req.nextUrl.searchParams.get("deal"), 120));
  if ("err" in g) return g.err;
  const db = await getDb();
  const [c] = await db.select().from(aiChats).where(and(eq(aiChats.userId, g.user!.id), g.deal ? eq(aiChats.dealId, g.deal.id) : isNull(aiChats.dealId))).orderBy(desc(aiChats.updatedAt)).limit(1);
  return NextResponse.json({ id: c?.id ?? null, messages: c?.messages ?? [] });
}

/** Ask a question: streams newline-delimited JSON events while the analyst reads the room and searches. */
export async function POST(req: NextRequest) {
  const { data } = await readBody(req);
  const g = await gate(str(data.deal, 120));
  if ("err" in g) return g.err;
  const user = g.user!, q = str(data.q, 2000);
  if (q.length < 2) return jerr("Type a question.");
  if (!(await allow(`ai:u:${user.id}`, 30, 3600)) || (user.officeId && !(await allow(`ai:o:${user.officeId}`, 150, 86400)))) return jerr(TOO_MANY, 429);
  const db = await getDb();
  const want = Number(data.id) || 0;
  let [chat] = want && !data.fresh ? await db.select().from(aiChats).where(and(eq(aiChats.id, want), eq(aiChats.userId, user.id))) : [];
  if (!chat) [chat] = await db.insert(aiChats).values({ userId: user.id, officeId: user.officeId, dealId: g.deal?.id ?? null, title: q.slice(0, 120) }).returning();
  const history = chat.messages.map((m) => ({ role: m.role, text: m.text }));
  const ctx = await context(user, g.names, g.deal);
  const enc = new TextEncoder();

  const body = new ReadableStream({
    async start(ctl) {
      const send = (o: unknown) => ctl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ t: "chat", id: chat.id });
      let text = "", cites: Cite[] = [], usage = { inputTokens: 0, outputTokens: 0, searches: 0 };
      try {
        for await (const ev of converse(ctx, history, q)) {
          if (ev.t === "text") text += ev.d;
          if (ev.t === "cite") cites.push(ev.c);
          if (ev.t === "done") usage = ev; else send(ev);
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : "";
        send({ t: "error", d: /overloaded|529/i.test(m) ? "The analyst is busy. Please try again in a minute." : "The analyst could not answer just now. Please try again." });
      }
      if (text.trim()) {
        const at = new Date().toISOString();
        const messages = [...chat.messages, { role: "user" as const, text: q, at }, { role: "assistant" as const, text, cites, at }];
        await db.update(aiChats).set({ messages, updatedAt: new Date(), searches: chat.searches + usage.searches, inputTokens: chat.inputTokens + usage.inputTokens, outputTokens: chat.outputTokens + usage.outputTokens }).where(eq(aiChats.id, chat.id));
      }
      send({ t: "done" });
      ctl.close();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
