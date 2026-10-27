import { and, desc, eq, ne, sql } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { offices } from "@/db/schema";
import { can, isSuper } from "@/lib/perm";
import { officeScope } from "@/lib/desk";
import { DkHead, DkEmpty, Ico, ICONS } from "@/components/DeskApp";

type P = { searchParams: Promise<{ q?: string; show?: string }> };
const TYPE: Record<string, string> = { family_office: "Family office", fund: "Fund", individual: "Individual" };

export default async function Investors({ searchParams }: P) {
  const me = await requireDesk();
  const { q = "", show = "" } = await searchParams;
  const FILTERS: [string, string][] = [["", "All"], ["pending", "To approve"], ["desk", isSuper(me) ? "Added by desk" : "Added by me"], ["registered", "Registered"]];
  const db = await getDb();
  const term = q.trim().slice(0, 80);
  const like = term ? `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const conds = [
    officeScope(me), // an analyst sees only the investors they added by hand, plus every registered office
    show === "pending" ? eq(offices.approval, "pending") : show === "desk" ? eq(offices.origin, "desk") : show === "registered" ? ne(offices.origin, "desk") : undefined,
    like ? sql`(${offices.name} ilike ${like} or ${offices.contactName} ilike ${like} or ${offices.city} ilike ${like} or ${offices.notes} ilike ${like})` : undefined,
  ].filter(Boolean);
  const rows = await db.select({ id: offices.id, name: offices.name, investorType: offices.investorType, city: offices.city, approval: offices.approval, origin: offices.origin, contactName: offices.contactName })
    .from(offices).where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`case when ${offices.approval} = 'pending' then 0 else 1 end`, desc(offices.createdAt)).limit(300);
  const href = (k: string) => { const p = new URLSearchParams(); if (term) p.set("q", term); if (k) p.set("show", k); const s = p.toString(); return `/desk/investors${s ? `?${s}` : ""}`; };
  return (
    <>
      <DkHead title="Investors" sub={`${rows.length}${rows.length === 300 ? "+" : ""} ${show ? FILTERS.find(([k]) => k === show)?.[1].toLowerCase() : "on the desk"}`}
        action={can(me, "investors.add") ? <a className="dk-iconbtn" href="/admin/offices?show=desk#add" aria-label="Add investors"><Ico d={ICONS.plus} /></a> : undefined} />
      <form className="dk-search" role="search" action="/desk/investors">
        <Ico d={ICONS.search} size={18} />
        <label className="sr-only" htmlFor="dk-q">Search investors</label>
        <input id="dk-q" type="search" name="q" defaultValue={term} placeholder="Name, person, city…" autoComplete="off" enterKeyHint="search" />
        {show ? <input type="hidden" name="show" value={show} /> : null}
      </form>
      <nav className="dk-chips" aria-label="Filter">
        {FILTERS.map(([k, l]) => <a key={k} href={href(k)} aria-current={show === k ? "true" : undefined}>{l}</a>)}
      </nav>
      {rows.length ? <ul className="dk-list dk-sec">{rows.map((o) => (
        <li key={o.id}><a className="dk-row" href={`/desk/investors/${o.id}`}>
          <span className="dk-av" aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
          <span className="dk-row-main"><b>{o.name}</b>
            <small>{[TYPE[o.investorType] ?? "Investor", o.contactName, o.city].filter(Boolean).join(" · ")}</small></span>
          {o.approval === "pending" ? <span className="dk-pill mid">Approve</span> : o.origin === "desk" ? <span className="dk-pill">Added</span> : null}
          <Ico d={ICONS.chevron} size={18} />
        </a></li>))}</ul>
        : <DkEmpty>{term ? `No investor matches “${term}”.` : "No investors here yet."}</DkEmpty>}
    </>
  );
}
