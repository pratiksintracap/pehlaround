import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeals, deskMembers } from "@/lib/desk";
import { DEAL_STAGES } from "@/lib/stages";
import { setDealStage } from "@/lib/desk-actions";
import { DkHead, DkToast, DkEmpty, shortDay } from "@/components/DeskApp";

type P = { searchParams: Promise<{ msg?: string; closed?: string }> };

export default async function Pipeline({ searchParams }: P) {
  const me = await requireDesk();
  const { msg, closed } = await searchParams;
  const [all, members] = await Promise.all([deskDeals(), deskMembers()]);
  const work = can(me, "workflow");
  const owner = new Map(members.map((m) => [m.id, m.name.split(" ")[0]]));
  const stages = DEAL_STAGES.filter((s) => s.id !== "closed" || closed);
  const by = (id: string) => all.filter((d) => (d.pipelineStage || "sourced") === id);
  const closedN = by("closed").length;
  return (
    <>
      <DkToast msg={msg} />
      <DkHead title="Pipeline" sub={`${all.length - closedN} active · ${closedN} closed`} />
      <nav className="dk-chips" aria-label="Stages">
        {stages.map((s) => <a key={s.id} href={`#s-${s.id}`} className={by(s.id).length ? "" : "dim"}>{s.label} <span>{by(s.id).length}</span></a>)}
        <a href={closed ? "/desk/pipeline" : "/desk/pipeline?closed=1"} className="ghost">{closed ? "Hide closed" : "Show closed"}</a>
      </nav>
      {stages.filter((s) => by(s.id).length).map((s) => {
        const list = by(s.id);
        return (
          <section className="dk-sec" id={`s-${s.id}`} key={s.id}>
            <h2>{s.label} <span className="dk-count">{list.length}</span></h2>
            {list.length ? <ul className="dk-cards">{list.map((d) => (
              <li key={d.id} id={`d${d.id}`} className="dk-card">
                <a className="dk-card-top" href={`/desk/deals/${d.id}`}>
                  <b>{d.company}</b>
                  <small>{[d.listed ? "Listed" : "Pre-IPO", d.ownerId ? owner.get(d.ownerId) : "No owner", d.stageAt ? `since ${shortDay(d.stageAt)}` : ""].filter(Boolean).join(" · ")}</small>
                </a>
                {work && (
                  <form action={setDealStage} className="dk-move">
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="back" value={`/desk/pipeline${closed ? "?closed=1" : ""}#d${d.id}`} />
                    <label className="sr-only" htmlFor={`st-${d.id}`}>Stage for {d.company}</label>
                    <select id={`st-${d.id}`} name="stage" defaultValue={d.pipelineStage || "sourced"}>
                      {DEAL_STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    <button className="dk-btn sm" type="submit">Move</button>
                  </form>
                )}
              </li>))}</ul> : <DkEmpty>No deals at this stage.</DkEmpty>}
          </section>
        );
      })}
    </>
  );
}
