// The desk inside the phone app: small server-rendered pieces shared by /desk, /desk/pipeline,
// /desk/investors and /desk/tasks. Phone-first layouts; the full console at /admin is unchanged.
import type { Task } from "@/lib/desk";
import { saveTask, setTaskDone } from "@/lib/desk-actions";
import { istDay } from "@/lib/stages";
import { fmtDay } from "@/components/DeskBits";

export const Ico = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="dk-ico"><path d={d} /></svg>
);
export const ICONS = {
  chevron: "M9 6l6 6-6 6",
  phone: "M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  chat: "M4 5h16v11H9l-5 4z",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  bell: "M12 3a5 5 0 0 0-5 5v3.5L5 15h14l-2-3.5V8a5 5 0 0 0-5-5zM10 18a2 2 0 0 0 4 0",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
};

/** The page title row: a large title, an optional line under it and an optional action on the right. */
export function DkHead({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="dk-head">
      <div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
      {action}
    </header>
  );
}

/** The result of the last action, shown briefly at the top (the server redirect carries it as ?msg=). */
export function DkToast({ msg }: { msg?: string }) {
  return msg ? <p className="dk-toast" role="status">{msg}</p> : null;
}

/** One task with a round tick box that marks it done (or reopens it) in one tap. */
export function DkTask({ t, back, who, about }: { t: Task; back: string; who?: string; about?: { href: string; label: string } | null }) {
  const today = istDay();
  const done = t.status === "done";
  const over = !done && !!t.dueOn && t.dueOn < today, due = !done && t.dueOn === today;
  return (
    <li className={`dk-task${done ? " done" : ""}${over ? " over" : ""}`}>
      <form action={setTaskDone}>
        <input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={done ? "0" : "1"} /><input type="hidden" name="back" value={back} />
        <button type="submit" className="dk-tick" aria-label={done ? `Reopen: ${t.title}` : `Mark done: ${t.title}`}>{done ? <Ico d="M5 12l5 5 9-10" size={16} /> : null}</button>
      </form>
      <div className="dk-task-main">
        <a className="dk-task-t" href={`/desk/tasks/${t.id}`}><b>{t.title}</b></a>
        <small>
          {t.dueOn ? <span className={over ? "dk-due bad" : due ? "dk-due mid" : "dk-due"}>{over ? "Overdue · " : due ? "Today · " : ""}{fmtDay(t.dueOn)}</span> : null}
          {who ? <span>{who}</span> : null}
          {about ? <a href={about.href}>{about.label}</a> : null}
        </small>
      </div>
    </li>
  );
}

/** A one-line "add a task" form: title, optional due date, and what it is about. */
export function DkAddTask({ back, officeId, dealId, assignees, me }: { back: string; officeId?: number; dealId?: number; assignees?: { id: number; name: string }[]; me: number }) {
  return (
    <form action={saveTask} className="dk-add">
      <input type="hidden" name="back" value={back} />
      {officeId ? <input type="hidden" name="officeId" value={officeId} /> : null}
      {dealId ? <input type="hidden" name="dealId" value={dealId} /> : null}
      <label className="sr-only" htmlFor={`t-${back}`}>New task</label>
      <input id={`t-${back}`} name="title" required maxLength={300} placeholder="Add a task…" autoComplete="off" />
      <div className="dk-add-row">
        <label className="dk-chip-in"><span>Due</span><input type="date" name="dueOn" /></label>
        {assignees && assignees.length > 1 ? (
          <label className="dk-chip-in"><span>For</span>
            <select name="assigneeId" defaultValue={me}>{assignees.map((m) => <option key={m.id} value={m.id}>{m.id === me ? "Me" : m.name}</option>)}</select></label>
        ) : null}
        <button className="dk-btn" type="submit">Add</button>
      </div>
    </form>
  );
}

/** Empty state for a list. */
export const DkEmpty = ({ children }: { children: React.ReactNode }) => <p className="dk-empty">{children}</p>;

/** "5 Oct" style short dates for lists. */
export const shortDay = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "";
export const ago = (d: Date) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return days < 7 ? `${days}d ago` : shortDay(d);
};

/** "Log a call" in one line, with an optional follow-up that becomes a task. */
export function DkLogCall({ action, dealId, officeId, back }: { action: (f: FormData) => Promise<void>; dealId?: number; officeId?: number; back: string }) {
  return (
    <details className="dk-add dk-call"><summary>Log a call</summary>
      <form action={action} className="dk-form">
        {dealId ? <input type="hidden" name="dealId" value={dealId} /> : null}
        {officeId ? <input type="hidden" name="officeId" value={officeId} /> : null}
        <input type="hidden" name="back" value={back} />
        <label className="sr-only" htmlFor={`call-${dealId ?? officeId}`}>How it went</label>
        <input id={`call-${dealId ?? officeId}`} name="outcome" required maxLength={2000} placeholder="How it went, in a line" />
        <div className="dk-row2"><input name="next" maxLength={200} placeholder="Next step (optional, becomes a task)" /><input type="date" name="due" aria-label="By when" /></div>
        <button className="dk-btn" type="submit">Save</button>
      </form>
    </details>
  );
}
