// The desk's workspace on one deal: pipeline stage and owner, tasks, notes, internal files and the change trail.
// Desk only; none of it reaches investors (the visibility switches in the deal editor stay separate).
import type { DeskDeal } from "@/lib/desk";
import { workspace, deskMembers, names } from "@/lib/desk";
import { setDealStage, setDealOwner, saveDeskNote, saveDeskFile } from "@/lib/desk-actions";
import { DEAL_STAGES, stageLabel } from "@/lib/stages";
import { can } from "@/lib/perm";
import { Changes, TaskRow, TaskForm, fmtT } from "@/components/DeskBits";
import { CHANNELS, INTEREST_STATUS, channelLabel, interestLabel, interestOn, interestSummary, isWarm, type Interest } from "@/lib/deal-interest";
import { saveInterest, addMatchToInterest } from "@/lib/deal-interest-actions";
import { matchInvestors } from "@/lib/investor-match";
import { istDay } from "@/lib/stages";

type Me = { id: number; role: string };

export async function DeskWorkspace({ d, me, back }: { d: DeskDeal; me: Me; back: string }) {
  const [ws, members, nm, interest, matches] = await Promise.all([workspace(d.id, me), deskMembers(), names(me), interestOn(d.id), d.debt ? Promise.resolve([]) : matchInvestors(d, 10)]);
  const work = can(me, "workflow"), del = can(me, "delete");
  const opts = { members: members.map((m) => ({ id: m.id, name: m.name })), deals: [...nm.deal.values()].map((x) => ({ id: x.id, name: x.company })), offices: [...nm.office.entries()].map(([id, name]) => ({ id, name })) };
  const open = ws.tasks.filter((t) => t.status === "open");
  const idx = DEAL_STAGES.findIndex((s) => s.id === d.pipelineStage);
  return (
    <section className="ws" id="desk" aria-label="Desk workspace">
      <div className="ws-head">
        <span className="k">Desk workspace · only the desk sees this</span>
        <ol className="ws-stages" aria-label={`Stage: ${stageLabel(d.pipelineStage)}`}>{DEAL_STAGES.map((s, i) => (
          <li key={s.id} className={i < idx ? "past" : i === idx ? "now" : ""} title={s.hint}>{s.label}</li>))}</ol>
        {work && <div className="ws-ctl">
          <form action={setDealStage} className="inline"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
            <label className="fine">Stage <select name="stage" defaultValue={d.pipelineStage}>{DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <button className="btn sm" type="submit">Move</button></form>
          <form action={setDealOwner} className="inline"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
            <label className="fine">Owner <select name="ownerId" defaultValue={d.ownerId ?? ""}><option value="">Nobody</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <button className="btn sm" type="submit">Set</button></form>
          <span className="fine">{d.stageAt ? `At this stage since ${fmtT(d.stageAt)}. ` : ""}The stage is the desk&apos;s own; it does not publish or open anything.</span>
        </div>}
      </div>

      <div className="chart" id="desk-interest" style={{ marginBottom: 16 }}>
        <span className="k">Interest · {interest.length ? interestSummary(interest) : "nobody yet"}</span>
        <p className="fine" style={{ margin: "2px 0 8px" }}>Who has been pitched and where they stand, including what happens on the phone, WhatsApp and email. Desk only.</p>
        {interest.length > 0 && <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Who</th><th>Status</th><th>Amount</th><th>How</th><th>Last contact</th><th>Note</th>{work && <th></th>}</tr></thead>
          <tbody>{interest.map((x) => (
            <tr key={x.id} style={x.status === "passed" ? { opacity: 0.6 } : undefined}>
              <th scope="row">{x.name}{x.firm && x.firm.toLowerCase() !== x.name.toLowerCase() ? <span className="fine"> · {x.firm}</span> : null}{x.contact ? <div className="fine">{x.contact}</div> : null}</th>
              <td><span className={`pill${isWarm(x.status) ? " ok" : ""}`}>{interestLabel(x.status)}</span></td>
              <td>{x.amountCr ? `₹${x.amountCr} Cr` : "—"}</td><td>{channelLabel(x.channel) || "—"}</td><td>{x.lastOn ?? "—"}</td>
              <td className="fine" style={{ maxWidth: 280 }}>{x.note}</td>
              {work && <td><details className="dt-edit"><summary>Edit</summary><InterestForm d={d.id} back={back} x={x} del={del} /></details></td>}
            </tr>))}</tbody></table></div>}
        {work && <details className="ws-add"><summary className="btn sm">+ Add who is interested</summary><InterestForm d={d.id} back={back} /></details>}
      </div>

      {!d.debt && <details className="chart" id="who-to-pitch" style={{ marginBottom: 16 }} open={matches.some((m) => !m.onList)}>
        <summary className="k" style={{ cursor: "pointer" }}>Who to pitch · {matches.filter((m) => !m.onList).length ? `${matches.filter((m) => !m.onList).length} investors on the platform fit this deal` : "no new matches"}</summary>
        <p className="fine" style={{ margin: "4px 0 8px" }}>Registered and desk-added investors ranked by fit: the sectors, ticket and structures they gave us, and what they have done on the platform (views, saves, NDAs, allocation requests). Offices that passed on this deal are left out. Desk only.</p>
        {matches.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Investor</th><th>Fit</th><th>Why</th><th>Contact</th>{work && <th></th>}</tr></thead>
          <tbody>{matches.map((m) => (
            <tr key={m.officeId} style={m.onList ? { opacity: 0.6 } : undefined}>
              <th scope="row"><a href={`/admin/offices/${m.officeId}`}>{m.name}</a><div className="fine">{[m.type, m.city, m.ticket].filter(Boolean).join(" · ")}</div></th>
              <td><b>{m.score}</b><span className="fine">/100</span></td>
              <td className="fine" style={{ maxWidth: 360 }}>{m.reasons.join(" · ") || "Profile is thin; no activity yet"}{m.flags.length > 0 && <div style={{ color: "#b26a00" }}>{m.flags.join(" · ")}</div>}</td>
              <td className="fine">{m.contact.name}{m.contact.email && <div className="mono">{m.contact.email}</div>}</td>
              {work && <td>{m.onList ? <span className="pill">On the interest list</span> : <form action={addMatchToInterest}><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="officeId" value={m.officeId} /><input type="hidden" name="back" value={`${back}#desk-interest`} /><button className="btn sm" type="submit">Add as pitched</button></form>}</td>}
            </tr>))}</tbody></table></div>
          : <p className="fine">No registered investor fits yet. Investors who fill in their sectors and ticket on their profile show up here.</p>}
      </details>}

      <div className="two ws-grid">
        <div className="chart" id="tasks"><span className="k">Tasks · {open.length} open</span>
          <ul className="dt-list">{ws.tasks.length ? ws.tasks.map((t) => <TaskRow key={t.id} t={t} back={`${back}#tasks`} del={del} showDeal={false} {...opts} />) : <li className="empty-li">No tasks on this deal.</li>}</ul>
          {work && <details className="ws-add"><summary className="btn sm">+ Add a task</summary><TaskForm back={`${back}#tasks`} dealId={d.id} me={me.id} {...opts} /></details>}
        </div>

        <div className="chart" id="notes"><span className="k">Desk notes · {ws.notes.length}</span>
          {work && <form action={saveDeskNote} className="form"><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="back" value={`${back}#notes`} />
            <label className="sr-only" htmlFor={`note-${d.id}`}>New note</label>
            <textarea id={`note-${d.id}`} name="body" rows={2} maxLength={8000} placeholder="Calls, views, what the promoter said, what to check next…" required />
            <div><button className="btn sm primary" type="submit">Add note</button></div></form>}
          <ul className="feed ws-notes">{ws.notes.length ? ws.notes.map((x) => (
            <li key={x.id}><span className="mono">{fmtT(x.createdAt)}</span><b>{x.who || "Desk"}</b>{x.officeId ? <> · {nm.office.get(x.officeId)}</> : null}{x.editedAt ? <span className="fine"> · edited</span> : null}
              <p className="ws-note">{x.body}</p>
              {work && (x.userId === me.id || del) && <details className="dt-edit"><summary>Edit</summary>
                <form action={saveDeskNote} className="form"><input type="hidden" name="id" value={x.id} /><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="back" value={`${back}#notes`} />
                  <textarea name="body" rows={3} defaultValue={x.body} maxLength={8000} /><div style={{ display: "flex", gap: 6 }}><button className="btn sm" type="submit">Save</button></div></form>
                {del && <form action={saveDeskNote}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="delete" value="on" /><input type="hidden" name="back" value={`${back}#notes`} />
                  <button className="btn sm ghost" type="submit">Delete note</button></form>}</details>}
            </li>)) : <li className="empty-li">No notes yet.</li>}</ul>
        </div>
      </div>

      <div className="two ws-grid">
        <div className="chart" id="files"><span className="k">Desk files · {ws.files.length}</span>
          <p className="fine" style={{ margin: "2px 0 8px" }}>Internal links (term sheets, KYC packs, CA notes). Never shown to investors{d.listed || d.debt ? "" : "; investor documents are in Documents below"}.</p>
          <ul className="feed">{ws.files.length ? ws.files.map((x) => (
            <li key={x.id}>{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer"><b>{x.title}</b></a> : <b>{x.title}</b>}{x.kind ? <span className="fine"> · {x.kind}</span> : null}
              <span className="fine"> · {x.who || "Desk"}, {fmtT(x.createdAt)}</span>{x.note ? <small className="dt-notes">{x.note}</small> : null}
              {work && <details className="dt-edit"><summary>Edit</summary>
                <form action={saveDeskFile} className="form"><input type="hidden" name="id" value={x.id} /><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="back" value={`${back}#files`} />
                  <div className="row"><label>Title<input name="title" defaultValue={x.title} required maxLength={300} /></label><label>Kind<input name="kind" defaultValue={x.kind ?? ""} maxLength={80} /></label></div>
                  <label>Link<input name="url" type="url" defaultValue={x.url ?? ""} placeholder="https://" /></label>
                  <label>Note<input name="note" defaultValue={x.note ?? ""} maxLength={2000} /></label>
                  <div><button className="btn sm" type="submit">Save</button></div></form>
                {del && <form action={saveDeskFile}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="delete" value="on" /><input type="hidden" name="back" value={`${back}#files`} />
                  <button className="btn sm ghost" type="submit">Delete file</button></form>}</details>}
            </li>)) : <li className="empty-li">No desk files yet.</li>}</ul>
          {work && <details className="ws-add"><summary className="btn sm">+ Add a file</summary>
            <form action={saveDeskFile} className="form"><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="back" value={`${back}#files`} />
              <div className="row"><label>Title<input name="title" required maxLength={300} placeholder="e.g. Signed term sheet" /></label><label>Kind<input name="kind" maxLength={80} placeholder="PDF, folder, sheet…" /></label></div>
              <label>Link<input name="url" type="url" placeholder="https://drive.google.com/…" /></label>
              <label>Note<input name="note" maxLength={2000} /></label>
              <div><button className="btn sm primary" type="submit">Add file</button></div></form></details>}
        </div>

        <div className="chart" id="trail"><span className="k">Activity · every desk change on this deal</span>
          <ul className="feed ws-trail">{ws.trail.length ? ws.trail.map((a) => (
            <li key={a.id}><span className="mono">{fmtT(a.at)}</span>{a.who ? <b>{a.who}: </b> : null}{a.action}<Changes d={a.detail} /></li>)) : <li className="empty-li">No changes recorded yet.</li>}</ul>
          <a className="btn sm" href={`/admin/log?deal=${d.id}`}>Full trail</a>
        </div>
      </div>
    </section>
  );
}

function InterestForm({ d, back, x, del }: { d: number; back: string; x?: Interest; del?: boolean }) {
  return (<>
    <form action={saveInterest} className="form">
      <input type="hidden" name="dealId" value={d} /><input type="hidden" name="back" value={`${back}#desk-interest`} />{x && <input type="hidden" name="id" value={x.id} />}
      <div className="row"><label>Name<input name="name" required maxLength={160} defaultValue={x?.name} placeholder="Person or firm" /></label><label>Firm<input name="firm" maxLength={160} defaultValue={x?.firm ?? ""} placeholder="Optional" /></label></div>
      <div className="row">
        <label>Status<select name="status" defaultValue={x?.status ?? "interested"}>{INTEREST_STATUS.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}</select></label>
        <label>Amount (₹ Cr)<input name="amountCr" inputMode="decimal" defaultValue={x?.amountCr ?? ""} placeholder="Optional" /></label>
      </div>
      <div className="row">
        <label>How<select name="channel" defaultValue={x?.channel ?? "phone"}>{CHANNELS.map((c) => <option key={c} value={c}>{channelLabel(c)}</option>)}</select></label>
        <label>Last contact<input type="date" name="lastOn" defaultValue={x?.lastOn ?? istDay()} max={istDay()} /></label>
      </div>
      <label>Phone or email<input name="contact" maxLength={160} defaultValue={x?.contact ?? ""} placeholder="Optional" /></label>
      <label>Note<input name="note" maxLength={2000} defaultValue={x?.note ?? ""} placeholder="What they said, what they need, next step" /></label>
      <div><button className="btn sm primary" type="submit">{x ? "Save" : "Add"}</button></div>
    </form>
    {x && del && <form action={saveInterest}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="dealId" value={d} /><input type="hidden" name="delete" value="on" /><input type="hidden" name="back" value={`${back}#desk-interest`} />
      <button className="btn sm ghost" type="submit">Remove</button></form>}
  </>);
}
