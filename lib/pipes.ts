// Room content is edited in the admin as plain lines, one item per line, fields separated by " | ".
import type { RoomContent, Status } from "@/lib/types";

const split = (l: string) => l.split("|").map((x) => x.trim());
const lines = (t: string) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const st = (s: string): Status => { const x = s.toLowerCase().replace(/[\s_]+/g, "-"); return x.startsWith("done") ? "done" : x.startsWith("in") ? "in-progress" : "pending"; };
const join = (a: (string | number | undefined)[]) => a.map((x) => x ?? "").join(" | ").replace(/( \| )+$/, "");

export const toText = {
  cells: (a: { k: string; v: string; s?: string }[]) => a.map((c) => join([c.k, c.v, c.s])).join("\n"),
  risks: (a: { t: string; d: string }[]) => a.map((r) => join([r.t, r.d])).join("\n"),
  feed: (a: { date: string; text: string }[]) => a.map((f) => join([f.date, f.text])).join("\n"),
  terms: (a: { k: string; v: string }[]) => a.map((t) => join([t.k, t.v])).join("\n"),
  path: (a: RoomContent["path"]) => a.map((p) => join([p.status, p.title, p.note])).join("\n"),
  checks: (a: RoomContent["checks"]) => a.map((c) => join([c.status, c.title, c.note, c.date])).join("\n"),
  pe: (a: NonNullable<RoomContent["pe"]>) => a.map((p) => join([p.label, p.sub, p.value])).join("\n"),
  list: (a: string[]) => a.join("\n"),
  founders: (a?: RoomContent["founders"]) => (a || []).map((f) => join([f.name, f.role, f.url])).join("\n"),
  fin: (f?: RoomContent["fin"]) => f ? [join(["Year", ...f.cols]), ...f.rows.map((r) => join([r.label, ...r.vals]))].join("\n") : "",
};

export const fromText = {
  cells: (t: string) => lines(t).map((l) => { const [k, v, s] = split(l); return { k, v: v ?? "", ...(s ? { s } : {}) }; }),
  risks: (t: string) => lines(t).map((l) => { const [a, ...b] = split(l); return { t: a, d: b.join(" | ") }; }),
  feed: (t: string) => lines(t).map((l) => { const [a, ...b] = split(l); return { date: a, text: b.join(" | ") }; }),
  terms: (t: string) => lines(t).map((l) => { const [a, ...b] = split(l); return { k: a, v: b.join(" | ") }; }),
  path: (t: string) => lines(t).map((l) => { const [s, title, note] = split(l); return { status: st(s), title: title ?? "", note: note ?? "" }; }),
  checks: (t: string) => lines(t).map((l) => { const [s, title, note, date] = split(l); return { status: st(s), title: title ?? "", ...(note ? { note } : {}), ...(date ? { date } : {}) }; }),
  pe: (t: string) => lines(t).map((l) => { const [label, sub, v] = split(l); return { label, sub: sub ?? "", value: parseFloat(v) || 0 }; }).filter((p) => p.value > 0),
  list: (t: string) => lines(t),
  /** "Name | Role | https://linkedin.com/in/..." — the link is kept only if it is a LinkedIn https URL. */
  founders: (t: string) => lines(t).map((l) => { const [name, role, url] = split(l); const u = (url || "").trim();
    return { name, role: role ?? "", ...(/^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\//i.test(u) ? { url: u } : {}) }; }).filter((f) => f.name),
  fin: (t: string, unit: string, note: string): RoomContent["fin"] => {
    const ls = lines(t); if (ls.length < 2) return undefined;
    const [, ...cols] = split(ls[0]);
    return { unit: unit || "₹ Cr", cols, rows: ls.slice(1).map((l) => { const [label, ...vals] = split(l); return { label, vals }; }), ...(note ? { note } : {}) };
  },
};
