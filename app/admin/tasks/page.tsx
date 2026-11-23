// Tasks and reminders across the desk: per deal and per investor, assigned to a super admin or an analyst.
// The 9 AM run emails each person their tasks that are due or overdue.
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskMembers, listTasks, names } from "@/lib/desk";
import { TaskRow, TaskForm } from "@/components/DeskBits";

export const dynamic = "force-dynamic";

const GROUPS = [
  { k: "before", label: "Before the Bell", note: "Pre-IPO and IPO deals." },
  { k: "after", label: "After the Bell", note: "Listed companies: blocks, placements, QIPs." },
  { k: "debt", label: "Debt", note: "Debt desk deals: loans, NCDs, commercial paper, acquisition finance." },
  { k: "misc", label: "Misc.", note: "Tasks not tied to a deal: investors, partners and general desk work." },
];

export default async function Tasks({ searchParams }: { searchParams: Promise<{ who?: string; status?: string; deal?: string; office?: string; type?: string }> }) {
  const me = await requireDesk();
  const { who = "me", status = "open", deal, office, type = "" } = await searchParams;
  const assigneeId = who === "all" ? undefined : who === "me" ? me.id : Number(who) || undefined;
  const st = status === "done" ? "done" : status === "all" ? "all" : "open";
  const [list, members, nm] = await Promise.all([
    listTasks({ assigneeId, status: st, dealId: Number(deal) || undefined, officeId: Number(office) || undefined, me }), deskMembers(), names(me)]);
  const opts = { members: members.map((m) => ({ id: m.id, name: m.name })), deals: [...nm.deal.values()].map((x) => ({ id: x.id, name: x.company })), offices: [...nm.office.entries()].map(([id, name]) => ({ id, name })) };
  const params = { who, status, deal: deal || "", office: office || "", type };
  const q = (k: keyof typeof params, v: string) => { const p = new URLSearchParams(Object.entries({ ...params, [k]: v }).filter(([, x]) => x) as [string, string][]); return `/admin/tasks?${p}`; };
  const back = q("status", status);
  const work = can(me, "workflow"), del = can(me, "delete");
  // Split by the book the task's deal sits in. A task with no deal (an investor, or general desk work) is Misc.
  const groupOf = (t: { dealId: number | null }) => { const d = t.dealId ? nm.deal.get(t.dealId) : undefined; return !d ? "misc" : d.listed ? "after" : d.debt ? "debt" : "before"; };
  const byGroup = new Map(GROUPS.map((g) => [g.k, list.filter((t) => groupOf(t) === g.k)]));
  const shown = type ? GROUPS.filter((g) => g.k === type) : GROUPS.filter((g) => byGroup.get(g.k)!.length);
  return (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "6px 0 6px" }}><h1 style={{ fontSize: 30, margin: 0 }}>Tasks</h1>{work && <a className="btn sm primary" href="#add">+ Add a task</a>}</div>
      <p className="fine" style={{ marginBottom: 10 }}>Tasks on a deal or an investor, for anyone on the desk. Whoever a task is for gets a reminder email at 9 AM on the day it is due, and each day after until it is done.</p>
      <div className="adm-filter">{[["me", "Mine"], ["all", "Everyone"], ...members.filter((m) => m.id !== me.id).map((m) => [String(m.id), m.name])].map(([k, l]) =>
        <a key={`w${k}`} href={q("who", k)} className={who === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter">{[["open", "Open"], ["done", "Done"], ["all", "All"]].map(([k, l]) => <a key={`s${k}`} href={q("status", k)} className={status === k ? "on" : ""}>{l}</a>)}
        {deal && <a href={q("deal", "")} className="on">Deal: {nm.deal.get(Number(deal))?.company} ✕</a>}{office && <a href={q("office", "")} className="on">Investor: {nm.office.get(Number(office))} ✕</a>}</div>
      <div className="adm-filter">{[["", "All types"], ...GROUPS.map((g) => [g.k, g.label])].map(([k, l]) =>
        <a key={`t${k}`} href={q("type", k)} className={type === k ? "on" : ""}>{l}{k ? ` · ${byGroup.get(k)!.length}` : ` · ${list.length}`}</a>)}</div>
      {!shown.length && <div className="chart" style={{ marginTop: 18 }}><ul className="dt-list"><li className="empty-li">Nothing here.</li></ul></div>}
      {shown.map((g) => (
        <section key={g.k} style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>{g.label} <span className="fine">· {byGroup.get(g.k)!.length}</span></h2>
          <p className="fine" style={{ margin: "0 0 8px" }}>{g.note}</p>
          <div className="chart"><ul className="dt-list">{byGroup.get(g.k)!.length ? byGroup.get(g.k)!.map((t) => <TaskRow key={t.id} t={t} back={back} del={del} {...opts} />) : <li className="empty-li">Nothing here.</li>}</ul></div>
        </section>))}
      {work && <div className="chart" style={{ marginTop: 22 }} id="add"><span className="k">Add a task</span>
        <TaskForm back={back} me={me.id} dealId={Number(deal) || undefined} officeId={Number(office) || undefined} {...opts} /></div>}
    </>
  );
}
