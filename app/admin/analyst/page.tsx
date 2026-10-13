import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { aiChats, deals, offices, users } from "@/db/schema";
import { aiReady, monthSpend } from "@/lib/ai";
import { getSettings } from "@/lib/settings";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** What offices ask the AI analyst: a read on what they care about, and a check on what it tells them. */
export default async function AnalystLog() {
  await requireAdmin();
  const db = await getDb();
  const [chats, ds, os, us, st, spent] = await Promise.all([
    db.select().from(aiChats).orderBy(desc(aiChats.updatedAt)).limit(200),
    db.select({ id: deals.id, company: deals.company }).from(deals), db.select({ id: offices.id, name: offices.name }).from(offices),
    db.select({ id: users.id, name: users.name }).from(users), getSettings(), monthSpend(),
  ]);
  const budget = Number(st.aiBudget) || 0;
  const deal = new Map(ds.map((x) => [x.id, x.company])), office = new Map(os.map((x) => [x.id, x.name])), user = new Map(us.map((x) => [x.id, x.name]));
  const qs = chats.reduce((n, c) => n + c.messages.filter((m) => m.role === "user").length, 0), searches = chats.reduce((n, c) => n + c.searches, 0);
  const tok = chats.reduce((n, c) => n + c.inputTokens + c.outputTokens, 0);
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>AI analyst</h1>
      <p className="fine" style={{ marginBottom: 16 }}>{!aiReady() ? "Not live: add ANTHROPIC_API_KEY in Vercel to switch it on." : st.aiAnalyst ? "Live for approved offices, in the dashboard and every room they have signed for." : "Switched off in Settings."} It reads only the rooms each office has signed for, and the web.</p>
      <div className="tiles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 18 }}>
        <div className="chart"><span className="k">Conversations</span><b style={{ fontSize: 26 }}>{chats.length}</b></div>
        <div className="chart"><span className="k">Questions asked</span><b style={{ fontSize: 26 }}>{qs}</b></div>
        <div className="chart"><span className="k">Web searches</span><b style={{ fontSize: 26 }}>{searches}</b></div>
        <div className="chart"><span className="k">Tokens used</span><b style={{ fontSize: 26 }}>{tok.toLocaleString("en-IN")}</b></div>
        <div className="chart"><span className="k">Spend this month (est.)</span><b style={{ fontSize: 26 }}>${spent.toFixed(2)}</b><small className="fine">{budget ? `of a $${budget} budget` : "no cap set"}</small></div>
      </div>
      {chats.length ? (
        <ul className="an-log">{chats.map((c) => (
          <li key={c.id}><details>
            <summary><b>{c.title}</b><small>{c.officeId ? office.get(c.officeId) : "Desk"} · {user.get(c.userId)} · {c.dealId ? deal.get(c.dealId) : "Dashboard"} · {c.messages.filter((m) => m.role === "user").length} questions · {fmtT(c.updatedAt)}</small></summary>
            <div className="an-log-t">{c.messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "u" : "a"}><span className="k">{m.role === "user" ? "Asked" : "Analyst"}</span><p>{m.text}</p>
                {!!m.cites?.length && <small className="fine">Sources: {m.cites.map((x) => x.title).join(" · ")}</small>}</div>))}</div>
          </details></li>))}</ul>
      ) : <p className="fine">No conversations yet.</p>}
    </>
  );
}
