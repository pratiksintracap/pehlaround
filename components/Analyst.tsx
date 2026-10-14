"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Cite = { url?: string; title: string; kind: "web" | "room" };
type Msg = { role: "user" | "assistant"; text: string; cites?: Cite[] };

// ---------- a small, safe markdown renderer (escape first, then a few constructs)
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
  .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
  .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (_m, t, u) => `<a href="${u}"${u.startsWith("/") ? "" : ' target="_blank" rel="noopener"'}>${t}</a>`);
function md(src: string) {
  const lines = src.replace(/\r/g, "").split("\n"), out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|[\s:-]+\|/.test(lines[i + 1] || "")) {
      const row = (x: string) => x.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = row(l); i += 2; const body: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      i--;
      out.push(`<div class="an-tw"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const h = l.match(/^#{1,4}\s+(.*)/); if (h) { out.push(`<h4>${inline(h[1])}</h4>`); continue; }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d+[.)]/.test(l), items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      i--;
      out.push(`<${ordered ? "ol" : "ul"}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    const para = [l]; while (i + 1 < lines.length && lines[i + 1].trim() && !/^(\s*[-*•]\s|\s*\d+[.)]\s|#|\s*\|)/.test(lines[i + 1])) para.push(lines[++i]);
    out.push(`<p>${para.map(inline).join("<br>")}</p>`);
  }
  return out.join("");
}
const ASK = /\[\[ask:\s*([^\]]+?)\s*\]\]/g;
const split = (t: string) => ({ body: t.replace(ASK, "").replace(/\n{3,}/g, "\n\n").trim(), asks: [...t.matchAll(ASK)].map((m) => m[1]) });
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

const Spark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8zM18.5 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" /></svg>;

export function Analyst({ deal, starters, who }: { deal: { slug: string; company: string } | null; starters: string[]; who: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // kept on screen beside the page (wide screens), remembered on this device
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [id, setId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<Record<string, "sending" | "done" | "err">>({});
  const loaded = useRef(false), box = useRef<HTMLDivElement>(null), ta = useRef<HTMLTextAreaElement>(null);
  const qs = deal ? `?deal=${encodeURIComponent(deal.slug)}` : "";

  useEffect(() => {
    let pin = false; try { pin = localStorage.getItem("omd_an_pin") === "1"; } catch {}
    if (pin && window.matchMedia("(min-width:1100px)").matches) { setPinned(true); setOpen(true); }
  }, []);
  useEffect(() => {
    // Pinned: the analyst sits under the site header and the page narrows beside it, so nothing is covered.
    const on = open && pinned, root = document.documentElement;
    document.body.classList.toggle("an-docked", on);
    if (!on) return () => document.body.classList.remove("an-docked");
    let raf = 0;
    const top = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const h = document.querySelector(".hdr"); root.style.setProperty("--an-top", `${Math.max(0, h ? h.getBoundingClientRect().bottom : 0)}px`); }); };
    top(); window.addEventListener("scroll", top, { passive: true }); window.addEventListener("resize", top);
    return () => { document.body.classList.remove("an-docked"); window.removeEventListener("scroll", top); window.removeEventListener("resize", top); cancelAnimationFrame(raf); };
  }, [open, pinned]);
  const pin = (v: boolean) => { setPinned(v); try { localStorage.setItem("omd_an_pin", v ? "1" : "0"); } catch {} };
  const close = () => { setOpen(false); if (pinned) pin(false); };
  useEffect(() => {
    const o = () => setOpen(true);
    window.addEventListener("omd-analyst", o);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.body.classList.contains("an-docked")) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("omd-analyst", o); window.removeEventListener("keydown", onKey); };
  }, []);
  useEffect(() => {
    if (!open || loaded.current) return; loaded.current = true;
    fetch("/api/ai/chat" + qs, { credentials: "same-origin" }).then((r) => r.json()).then((j) => { if (j.id) { setId(j.id); setMsgs(j.messages || []); } }).catch(() => {});
    setTimeout(() => ta.current?.focus(), 200);
  }, [open, qs]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, status]);

  const ask = useCallback(async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    setQ(""); setBusy(true); setStatus("Thinking");
    setMsgs((m) => [...m, { role: "user", text: t }, { role: "assistant", text: "", cites: [] }]);
    const patch = (f: (a: Msg) => Msg) => setMsgs((m) => { const c = [...m]; c[c.length - 1] = f(c[c.length - 1]); return c; });
    try {
      const r = await fetch("/api/ai/chat", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/x-ndjson" }, body: JSON.stringify({ q: t, deal: deal?.slug || "", id }) });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        const msg = typeof j.error === "string" ? j.error : r.status === 504 ? "The analyst took too long to answer. Please try again, or ask a narrower question." : "The analyst could not answer just now. Please try again.";
        throw new Error(msg);
      }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let n; while ((n = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, n); buf = buf.slice(n + 1); if (!line.trim()) continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.t === "chat") setId(ev.id);
          else if (ev.t === "status") setStatus(ev.d);
          else if (ev.t === "text") { setStatus(""); patch((a) => ({ ...a, text: a.text + ev.d })); }
          else if (ev.t === "cite") patch((a) => ({ ...a, cites: [...(a.cites || []), ev.c] }));
          else if (ev.t === "error") patch((a) => ({ ...a, text: a.text + (a.text ? "\n\n" : "") + "⚠ " + ev.d }));
        }
      }
    } catch (e) {
      patch((a) => ({ ...a, text: "⚠ " + (e instanceof Error ? e.message : "Something went wrong.") }));
    }
    setBusy(false); setStatus("");
  }, [busy, deal, id]);

  const postQ = async (text: string) => {
    if (!deal) return;
    setAsked((a) => ({ ...a, [text]: "sending" }));
    const r = await fetch(`/api/room/${deal.slug}/question`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ question: text, private: true }) }).catch(() => null);
    setAsked((a) => ({ ...a, [text]: r && r.ok ? "done" : "err" }));
  };

  return (
    <>
      {!open && <button type="button" className="an-fab" onClick={() => setOpen(true)} aria-haspopup="dialog"><Spark /><span>Ask the analyst</span></button>}
      <aside className={`an-drawer${open ? " on" : ""}${pinned ? " dock" : ""}`} role="dialog" aria-modal="false" aria-label="AI analyst" hidden={!open}>
        <header className="an-head">
          <span className="an-logo"><Spark /></span>
          <div><b>Desk analyst</b><small>{deal ? `${deal.company} room` : "All your rooms"} · AI</small></div>
          <button type="button" className="btn sm ghost" onClick={() => { setMsgs([]); setId(null); setAsked({}); ta.current?.focus(); }} disabled={busy}>New chat</button>
          <button type="button" className="an-pin" aria-pressed={pinned} onClick={() => pin(!pinned)} title={pinned ? "Let the page use the full width again" : "Keep the analyst open beside the page"}>{pinned ? "Unpin" : "Keep on screen"}</button>
          <button type="button" className="an-x" onClick={close} aria-label="Close the analyst">✕</button>
        </header>
        <div className="an-body" ref={box} aria-live="polite">
          {!msgs.length && (
            <div className="an-hello">
              <p><b>Hello {who.split(" ")[0]}.</b> Ask about {deal ? deal.company : "the companies in your rooms"}, listed peers, the sector, the cap table or the IPO path. Answers come from {deal ? "this room" : "the rooms you have opened"} and, where needed, the web, with sources.</p>
              <div className="an-starters">{starters.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}</div>
            </div>
          )}
          {msgs.map((m, i) => {
            if (m.role === "user") return <div key={i} className="an-u">{m.text}</div>;
            const { body, asks } = split(m.text), last = i === msgs.length - 1;
            return (
              <div key={i} className="an-a">
                {body ? <div className="an-md" dangerouslySetInnerHTML={{ __html: md(body) }} /> : null}
                {last && busy && <div className="an-status"><i /><i /><i /><span>{status || "Writing"}</span></div>}
                {!!m.cites?.length && (!busy || !last) && (
                  <div className="an-cites"><span>Sources</span>{m.cites.map((c, k) => c.kind === "room"
                    ? <a key={k} className="room" href={c.url}>{c.title}</a>
                    : <a key={k} href={c.url} target="_blank" rel="noopener" title={c.title}>{host(c.url || "") || c.title}</a>)}</div>
                )}
                {!!asks.length && deal && (!busy || !last) && (
                  <div className="an-asks"><span>Ask the promoter</span>{asks.map((a) => (
                    <button key={a} type="button" disabled={!!asked[a]} onClick={() => postQ(a)} className={asked[a] === "done" ? "done" : ""}>
                      {asked[a] === "done" ? "✓ Posted privately to Q&A: " : asked[a] === "err" ? "Could not post: " : ""}{a}</button>))}</div>
                )}
              </div>
            );
          })}
        </div>
        <form className="an-foot" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <textarea ref={ta} rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder={deal ? `Ask about ${deal.company}, its peers or sector` : "Ask about your rooms, peers, sectors or IPOs"} maxLength={2000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} aria-label="Your question" />
          <button className="btn primary" type="submit" disabled={busy || !q.trim()} aria-label="Send">↑</button>
          <p className="an-fine">AI can be wrong; check the sources. Information, not investment advice. Conversations are kept on your office&apos;s record and the desk can read them.</p>
        </form>
      </aside>
    </>
  );
}
