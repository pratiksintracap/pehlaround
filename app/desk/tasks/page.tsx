import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskMembers, listTasks, names } from "@/lib/desk";
import { istDay } from "@/lib/stages";
import { DkHead, DkToast, DkTask, DkAddTask, DkEmpty } from "@/components/DeskApp";

type P = { searchParams: Promise<{ msg?: string; view?: string }> };
const VIEWS: [string, string][] = [["", "Mine"], ["all", "Everyone"], ["done", "Done"]];

export default async function Tasks({ searchParams }: P) {
  const me = await requireDesk();
  const { msg, view = "" } = await searchParams;
  const [list, members, nm] = await Promise.all([
    listTasks({ me, status: view === "done" ? "done" : "open", assigneeId: view === "" ? me.id : undefined }),
    deskMembers(),
    names(me),
  ]);
  const back = `/desk/tasks${view ? `?view=${view}` : ""}`;
  const today = istDay();
  const who = (uid: number | null) => members.find((m) => m.id === uid)?.name.split(" ")[0];
  const about = (t: (typeof list)[number]) => t.officeId && nm.office.get(t.officeId) ? { href: `/desk/investors/${t.officeId}`, label: nm.office.get(t.officeId)! }
    : t.dealId && nm.deal.get(t.dealId) ? { href: `/desk/deals/${t.dealId}`, label: nm.deal.get(t.dealId)!.company } : null;
  const groups: [string, typeof list][] = view === "done" ? [["Recently done", list.slice(0, 60)]] : [
    ["Overdue", list.filter((t) => t.dueOn && t.dueOn < today)],
    ["Today", list.filter((t) => t.dueOn === today)],
    ["Upcoming", list.filter((t) => t.dueOn && t.dueOn > today)],
    ["No date", list.filter((t) => !t.dueOn)],
  ];
  return (
    <>
      <DkToast msg={msg} />
      <DkHead title="Tasks" sub={view === "done" ? "Finished recently" : `${list.length} open${view === "" ? " for you" : " on the desk"}`} />
      <nav className="dk-seg" aria-label="Show">
        {VIEWS.map(([k, l]) => <a key={k} href={`/desk/tasks${k ? `?view=${k}` : ""}`} aria-current={view === k ? "true" : undefined}>{l}</a>)}
      </nav>
      {can(me, "workflow") && view !== "done" && <DkAddTask back={back} assignees={members.map((m) => ({ id: m.id, name: m.name }))} me={me.id} />}
      {list.length === 0 && <DkEmpty>{view === "done" ? "Nothing finished yet." : "All clear. Nothing open."}</DkEmpty>}
      {groups.filter(([, g]) => g.length).map(([label, g]) => (
        <section className="dk-sec" key={label}>
          <h2 className={label === "Overdue" ? "bad" : ""}>{label} <span className="dk-count">{g.length}</span></h2>
          <ul className="dk-list">{g.map((t) => <DkTask key={t.id} t={t} back={back} who={view === "" ? undefined : who(t.assigneeId)} about={about(t)} />)}</ul>
        </section>
      ))}
    </>
  );
}
