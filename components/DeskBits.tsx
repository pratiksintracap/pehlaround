// Small pieces the desk workflow pages share: the change list in the audit trail and task rows.
import type { AuditDetail } from "@/db/schema";
import type { Task } from "@/lib/desk";
import { saveTask, setTaskDone } from "@/lib/desk-actions";
import { istDay } from "@/lib/stages";

export const fmtT = (d: Date) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const fmtDay = (v: string | null) => (v ? new Date(v + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

const LABEL: Record<string, string> = { pipelineStage: "Stage", ownerId: "Owner", dueOn: "Due", dealId: "Deal", officeId: "Investor", listingLabel: "Listing", roundCr: "Round (₹ Cr)",
  sizeCr: "Size (₹ Cr)", dealType: "Deal type", contactName: "Contact", contactEmail: "Email", contactPhone: "Phone", headline: "Summary" };
const show = (v: unknown) => v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "object" ? JSON.stringify(v).slice(0, 120) : String(v);

/** "Stage: Diligence → Live" lines for an audit row. */
export function Changes({ d }: { d: AuditDetail | null }) {
  if (!d) return null;
  const rows = Object.entries(d.changes || {});
  return (
    <>{d.note && <small className="fine chg-note">{d.note}</small>}
      {rows.length > 0 && <ul className="chg">{rows.map(([k, [a, b]]) => (
        <li key={k}><span className="k">{LABEL[k] || k.replace(/([A-Z])/g, " $1").toLowerCase()}</span> <s>{show(a)}</s> → <b>{show(b)}</b></li>))}</ul>}</>
  );
}

type Opt = { id: number; name: string };
/** One task: done/reopen in one click, details and edit underneath. */
export function TaskRow({ t, back, members, deals, offices, del, showDeal = true }: { t: Task; back: string; members: Opt[]; deals: Opt[]; offices: Opt[]; del: boolean; showDeal?: boolean }) {
  const today = istDay();
  const over = t.status === "open" && !!t.dueOn && t.dueOn < today, due = t.status === "open" && t.dueOn === today;
  const who = members.find((m) => m.id === t.assigneeId)?.name ?? "—";
  const deal = deals.find((d) => d.id === t.dealId), office = offices.find((o) => o.id === t.officeId);
  return (
    <li className={`dt ${t.status === "done" ? "done" : ""} ${over ? "over" : ""}`}>
      <form action={setTaskDone}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.status === "done" ? "0" : "1"} /><input type="hidden" name="back" value={back} />
        <button className="dt-box" type="submit" aria-label={t.status === "done" ? `Reopen: ${t.title}` : `Mark done: ${t.title}`} title={t.status === "done" ? "Reopen" : "Mark done"}>{t.status === "done" ? "✓" : ""}</button></form>
      <div className="dt-main">
        <b>{t.title}</b>
        <small className="fine">{who}{t.dueOn ? <> · <span className={over ? "pill bad" : due ? "pill mid" : ""}>{over ? "overdue, " : due ? "due today, " : "due "}{fmtDay(t.dueOn)}</span></> : ""}
          {showDeal && deal ? <> · <a href={`/admin/deals/${deal.id}#desk`}>{deal.name}</a></> : ""}{office ? <> · <a href={`/admin/offices#o${office.id}`}>{office.name}</a></> : ""}
          {t.status === "done" && t.doneBy ? ` · done by ${t.doneBy}` : ""}{t.createdBy && t.createdBy !== who ? ` · from ${t.createdBy}` : ""}</small>
        {t.notes && <small className="dt-notes">{t.notes}</small>}
        <details className="dt-edit"><summary>Edit</summary>
          <TaskForm t={t} back={back} members={members} deals={deals} offices={offices} />
          {del && <form action={saveTask} style={{ marginTop: 6 }}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="delete" value="on" /><input type="hidden" name="back" value={back} />
            <button className="btn sm ghost" type="submit">Delete task</button></form>}
        </details>
      </div>
    </li>
  );
}

/** New task, or edit one. Fixed deal or investor come in as hidden fields. */
export function TaskForm({ t, back, members, deals, offices, dealId, officeId, me }: { t?: Task; back: string; members: Opt[]; deals: Opt[]; offices: Opt[]; dealId?: number; officeId?: number; me?: number }) {
  return (
    <form action={saveTask} className="form dt-form">
      {t && <input type="hidden" name="id" value={t.id} />}<input type="hidden" name="back" value={back} />
      <label>Task<input name="title" required maxLength={300} defaultValue={t?.title} placeholder="e.g. Chase the CA certificate" /></label>
      <div className="row">
        <label>For<select name="assigneeId" defaultValue={t?.assigneeId ?? me ?? ""}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Due (9 AM reminder that day)<input type="date" name="dueOn" defaultValue={t?.dueOn ?? ""} /></label>
      </div>
      {dealId ? <input type="hidden" name="dealId" value={dealId} /> : null}
      {officeId ? <input type="hidden" name="officeId" value={officeId} /> : null}
      {(!dealId || !officeId) && <div className="row">
        {!dealId && <label>Deal<select name="dealId" defaultValue={t?.dealId ?? ""}><option value="">Not about one deal</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        {!officeId && <label>Investor<select name="officeId" defaultValue={t?.officeId ?? ""}><option value="">Not about one investor</option>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
      </div>}
      <label>Notes<textarea name="notes" rows={2} maxLength={4000} defaultValue={t?.notes ?? ""} /></label>
      <div><button className="btn sm primary" type="submit">{t ? "Save task" : "Add task"}</button></div>
    </form>
  );
}
