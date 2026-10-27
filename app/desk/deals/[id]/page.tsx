import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { interests, ndas } from "@/db/schema";
import { can } from "@/lib/perm";
import { deskDeal, deskMembers, hiddenOffices, names, workspace } from "@/lib/desk";
import { DEAL_STAGES, stageLabel } from "@/lib/stages";
import { saveDeskNote, setDealOwner, setDealStage, logCall } from "@/lib/desk-actions";
import { readinessFor } from "@/lib/transfer";
import { DkToast, DkTask, DkAddTask, DkEmpty, DkLogCall, Ico, ICONS, ago, shortDay } from "@/components/DeskApp";

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };

// One deal on the phone: stage and owner, tasks, desk notes, desk files, who has signed and indicated, and the trail.
// Desk only. Editing the deal's content (terms, documents, the room) stays in the console.
export default async function DeskDeal({ params, searchParams }: P) {
  const me = await requireDesk();
  const [{ id: raw }, { msg }] = await Promise.all([params, searchParams]);
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const d = await deskDeal(id);
  if (!d) notFound();
  const db = await getDb();
  const back = `/desk/deals/${d.id}`;
  const [ws, members, nm, signed, book, hidden] = await Promise.all([
    workspace(d.id, me),
    deskMembers(),
    names(me),
    db.select({ officeId: ndas.officeId, signedAt: ndas.signedAt }).from(ndas).where(eq(ndas.dealId, d.id)).orderBy(desc(ndas.signedAt)),
    db.select({ officeId: interests.officeId, amountCr: interests.amountCr, status: interests.status }).from(interests).where(eq(interests.dealId, d.id)),
    hiddenOffices(me),
  ]);
  const work = can(me, "workflow");
  const idx = DEAL_STAGES.findIndex((s) => s.id === d.pipelineStage);
  const who = (uid: number | null) => members.find((m) => m.id === uid)?.name.split(" ")[0];
  const office = (oid: number) => (hidden.has(oid) ? null : nm.office.get(oid) ?? null);
  const live = book.filter((b) => b.status !== "Withdrawn");
  const readyBy = await readinessFor([...new Set(live.map((b) => b.officeId))]);
  const indicated = live.reduce((s, b) => s + (Number(b.amountCr) || 0), 0);
  const open = ws.tasks.filter((t) => t.status === "open");
  const L = d.listedInfo ?? {};
  const facts: [string, string | null | undefined][] = d.listed
    ? [["Deal", L.dealType], ["Side", L.side], ["Exchange", [L.exchange, L.ticker].filter(Boolean).join(": ")], ["Size", d.roundCr ? `₹${d.roundCr} Cr` : null], ["Price", L.price], ["Counterparty", L.counterparty]]
    : [["Round", d.roundLabel], ["Pre-money", d.preMoney], ["P/E", d.peLabel], ["Listing", d.listingLabel], ["Min ticket", d.minTicket], ["On the site", d.published ? (d.open ? "Published, room open" : "Published, closed") : d.preview ? "Coming soon" : "Not published"]];
  return (
    <>
      <DkToast msg={msg} />
      <a className="dk-back" href={`/desk/pipeline#d${d.id}`}><Ico d="M15 6l-6 6 6 6" size={18} /> Pipeline</a>
      <header className="dk-dealhead">
        <span className="dk-pill">{d.listed ? "Listed company" : d.category}</span>
        <h1>{d.company}</h1>
        <p>{d.listed ? d.headline : d.title}</p>
      </header>

      <ol className="dk-stagebar" aria-label={`Stage: ${stageLabel(d.pipelineStage)}`}>
        {DEAL_STAGES.map((s, i) => <li key={s.id} className={i < idx ? "past" : i === idx ? "now" : ""}><span>{s.label}</span></li>)}
      </ol>
      {work && (
        <div className="dk-ctl">
          <form action={setDealStage}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
            <label className="dk-field"><span>Stage</span><select name="stage" defaultValue={d.pipelineStage}>{DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <button className="dk-btn sm" type="submit">Move</button></form>
          <form action={setDealOwner}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
            <label className="dk-field"><span>Owner</span><select name="ownerId" defaultValue={d.ownerId ?? ""}><option value="">Nobody</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <button className="dk-btn sm" type="submit">Set</button></form>
          {d.stageAt ? <p className="dk-fine">At {stageLabel(d.pipelineStage)} since {shortDay(d.stageAt)}. The stage is the desk&apos;s own; nothing on the site changes with it.</p> : null}
        </div>
      )}

      <dl className="dk-facts">{facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

      {!d.listed && (
        <section className="dk-sec">
          <h2>Investors</h2>
          <div className="dk-stats two">
            <div><b>{signed.length}</b><span>NDAs signed</span></div>
            <div><b>{indicated ? `₹${indicated.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr` : "—"}</b><span>Indicated{d.roundCr ? ` of ₹${d.roundCr} Cr` : ""}</span></div>
          </div>
          {live.length > 0 && <ul className="dk-list">{live.map((b, i) => { const n = office(b.officeId); return (
            <li key={i}><a className="dk-row" href={n ? `/desk/investors/${b.officeId}` : undefined}>
              <span className="dk-row-main"><b>{n ?? "An investor"}</b><small>{b.status}{(() => { const r = readyBy.get(b.officeId); return r ? ` · transfer ${r.ready ? (r.checked ? "checked ✓" : "ready, to check") : `${r.done}/${r.total}`}` : ""; })()}</small></span>
              <span className="dk-stage">₹{Number(b.amountCr).toLocaleString("en-IN")} Cr</span>
            </a></li>); })}</ul>}
          {signed.length > 0 && <details className="dk-done"><summary>Who signed ({signed.length})</summary>
            <ul className="dk-list">{signed.map((s, i) => { const n = office(s.officeId); return (
              <li key={i}><a className="dk-row" href={n ? `/desk/investors/${s.officeId}` : undefined}><span className="dk-row-main"><b>{n ?? "An investor"}</b><small>{shortDay(s.signedAt)}</small></span></a></li>); })}</ul></details>}
        </section>
      )}

      <section className="dk-sec">
        <h2>Tasks <span className="dk-count">{open.length}</span></h2>
        {open.length ? <ul className="dk-list">{open.map((t) => <DkTask key={t.id} t={t} back={back} who={who(t.assigneeId)}
          about={t.officeId && office(t.officeId) ? { href: `/desk/investors/${t.officeId}`, label: office(t.officeId)! } : null} />)}</ul> : <DkEmpty>No open tasks.</DkEmpty>}
        {work && <DkAddTask back={back} dealId={d.id} assignees={members.map((m) => ({ id: m.id, name: m.name }))} me={me.id} />}
      </section>

      <section className="dk-sec">
        <h2>Notes <span className="dk-count">{ws.notes.length}</span></h2>
        {work && <DkLogCall action={logCall} dealId={d.id} back={back} />}
        {work && (
          <form action={saveDeskNote} className="dk-note-form">
            <input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="back" value={back} />
            <label className="sr-only" htmlFor="dk-note">New note</label>
            <textarea id="dk-note" name="body" rows={3} required maxLength={8000} placeholder="Calls, views, what the promoter said, what to check next…" />
            <button className="dk-btn" type="submit">Save note</button>
          </form>
        )}
        {ws.notes.length ? <ul className="dk-notes">{ws.notes.map((n) => (
          <li key={n.id}><p>{n.body}</p><small>{n.who || "Desk"}{n.officeId && office(n.officeId) ? ` · ${office(n.officeId)}` : ""} · {ago(n.createdAt)}</small></li>))}</ul>
          : <DkEmpty>No notes yet.</DkEmpty>}
      </section>

      {ws.files.length > 0 && (
        <section className="dk-sec">
          <h2>Desk files</h2>
          <ul className="dk-list">{ws.files.map((f) => (
            <li key={f.id}><a className="dk-row" href={f.url ?? undefined} target="_blank" rel="noopener noreferrer">
              <span className="dk-row-main"><b>{f.title}</b><small>{[f.kind, f.who, shortDay(f.createdAt)].filter(Boolean).join(" · ")}</small></span>
              {f.url ? <Ico d={ICONS.chevron} size={18} /> : null}
            </a></li>))}</ul>
        </section>
      )}

      <section className="dk-sec">
        <h2>Activity</h2>
        {ws.trail.length ? <ul className="dk-feed">{ws.trail.slice(0, 15).map((a) => (
          <li key={a.id}><span className="dk-dot" aria-hidden="true" /><div><p>{a.who ? <b>{a.who}: </b> : null}{a.action}</p><small>{ago(a.at)}</small></div></li>))}</ul>
          : <DkEmpty>No changes recorded yet.</DkEmpty>}
      </section>

      <a className="dk-console" href={d.listed ? `/admin/after-the-bell/${d.id}` : `/admin/deals/${d.id}`}><Ico d={ICONS.grid} size={18} /> Edit the deal in the console</a>
    </>
  );
}
