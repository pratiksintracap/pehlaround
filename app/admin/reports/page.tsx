// Day report (MIS): each desk member's start-of-day plan and end-of-day account, built from the portal itself.
// The member downloads it (PDF) or copies it (text) and sends it on WhatsApp; the desk logs that, and at the cut-off
// emails the same report to the recipients, flagging any that did not come in (lib/day-report.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireDesk } from "@/lib/auth";
import { isSuper } from "@/lib/perm";
import { istDay } from "@/lib/stages";
import { buildDayReport, cutoffInstant, deskPeople, KIND_LABEL, prettyDay, reportLog, reportSettings, saveReportSettings, workingDay, type ReportKind } from "@/lib/day-report";
import DayReportActions from "@/components/DayReportActions";

export const dynamic = "force-dynamic";

const istTime = (d: Date) => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(11, 16);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

async function saveSettings(f: FormData) {
  "use server";
  await requireAdmin();
  const from = f.getAll("from").map(Number).filter(Boolean);
  const to = String(f.get("to") || "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const cutoff = /^\d{2}:\d{2}$/.test(String(f.get("cutoff"))) ? String(f.get("cutoff")) : "19:30";
  await saveReportSettings({ from, to, cutoff, saturdays: f.get("saturdays") === "on" });
  revalidatePath("/admin/reports");
  redirect("/admin/reports?msg=" + encodeURIComponent("Day report settings saved.") + "#settings");
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ kind?: string; who?: string; day?: string }> }) {
  const me = await requireDesk();
  const sp = await searchParams;
  const sup = isSuper(me);
  const today = istDay();
  const hour = Number(new Date(Date.now() + 5.5 * 36e5).toISOString().slice(11, 13));
  const kind: ReportKind = sp.kind === "start" || sp.kind === "end" ? sp.kind : hour < 14 ? "start" : "end";
  const who = sup ? Number(sp.who) || me.id : me.id;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day || "") && sp.day! <= today ? sp.day! : today;
  const [r, people, cfg] = await Promise.all([buildDayReport(kind, who, day), deskPeople(), reportSettings()]);
  const histFrom = addDays(today, -13);
  const log = await reportLog(sup ? histFrom : day, today);
  const mine = log.get(`${who}|${day}|${kind}`);
  const q = (o: Record<string, string | number>) => `/admin/reports?${new URLSearchParams(Object.entries({ kind, who, day, ...o }).map(([k, v]) => [k, String(v)]))}`;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const senders = people.filter((p) => cfg.from.includes(p.id));

  return (
    <>
      <h1>Day report</h1>
      <p className="fine">Built from what the portal records: tasks, deal updates, notes, new investors and leads. Download or copy it at the start and end of the day and send it to Pratik on WhatsApp. The end-of-day report is due by {cfg.cutoff} IST; at that time the desk emails the same report to {cfg.to.join(", ") || "the recipients"}, and flags it if it did not come in.</p>

      <div className="adm-filter">{(["start", "end"] as const).map((k) => <a key={k} href={q({ kind: k })} className={kind === k ? "on" : ""}>{KIND_LABEL[k]}</a>)}</div>
      {sup && <div className="adm-filter">{people.map((p) => <a key={p.id} href={q({ who: p.id })} className={who === p.id ? "on" : ""}>{p.name}</a>)}</div>}
      <form className="adm-filter" action="/admin/reports" style={{ alignItems: "center" }}>
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="who" value={who} />
        <label className="fine">Day <input type="date" name="day" defaultValue={day} max={today} /></label> <button className="btn sm" type="submit">Show</button>
        {day !== today && <a href={q({ day: today })}>Today</a>}
      </form>

      <p className="fine" style={{ marginTop: 10 }}>{mine ? <>Taken at <b>{istTime(mine.at)} IST</b>{kind === "end" && mine.at > cutoffInstant(day, cfg.cutoff) ? ` (after the ${cfg.cutoff} cut-off)` : ""}.</> : <>Not taken yet{kind === "end" && workingDay(day, cfg.saturdays) ? ` · due by ${cfg.cutoff} IST` : ""}.</>}</p>

      {r && <DayReportActions kind={kind} who={who} day={day} own={who === me.id} />}

      {r && (
        <section className="adm-card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>{KIND_LABEL[kind]} · {r.person.name} · {prettyDay(day)}</h2>
          <p className="fine" style={{ margin: "0 0 10px" }}>{r.counts.map((c) => `${c.label} ${c.n}`).join(" · ")}</p>
          {r.books.filter((b) => b.blocks.length).map((b) => (
            <div key={b.k} style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>{b.label}</h3>
              {b.blocks.map((blk) => (
                <div key={blk.title} style={{ margin: "6px 0 10px" }}>
                  <p className="fine" style={{ margin: "0 0 4px", fontStyle: "italic" }}>{blk.title}</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{blk.lines.map((l, i) => <li key={i}>{l.text}{l.deal && <span className="fine"> · {l.deal}</span>}{l.extra && <span className="fine"> · {l.extra}</span>}</li>)}</ul>
                </div>))}
            </div>))}
          {!r.books.some((b) => b.blocks.length) && <p>{kind === "start" ? "Nothing due or overdue." : "No tasks or updates recorded in the portal for this day."}</p>}
          {r.desk.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>Desk</h3>
              {r.desk.map((blk) => (
                <div key={blk.title} style={{ margin: "6px 0 10px" }}>
                  <p className="fine" style={{ margin: "0 0 4px", fontStyle: "italic" }}>{blk.title}</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{blk.lines.map((l, i) => <li key={i}>{l.text}{l.extra && <span className="fine"> · {l.extra}</span>}</li>)}</ul>
                </div>))}
            </div>)}
        </section>)}

      {sup && (
        <section className="adm-card" style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>Who sent what, last 14 days</h2>
          <p className="fine">The time each person took their own report. Red: the end-of-day report did not come in by {cfg.cutoff}.</p>
          {senders.length ? (
            <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Day</th>{senders.map((p) => <th key={p.id} colSpan={2}>{p.name}</th>)}</tr>
              <tr><th></th>{senders.map((p) => [<th key={`${p.id}s`} className="fine">Start</th>, <th key={`${p.id}e`} className="fine">End</th>])}</tr></thead>
              <tbody>{days.map((d) => {
                const work = workingDay(d, cfg.saturdays);
                return (<tr key={d} style={work ? undefined : { opacity: 0.55 }}><td>{prettyDay(d)}</td>{senders.map((p) => {
                  const s = log.get(`${p.id}|${d}|start`), e = log.get(`${p.id}|${d}|end`);
                  const due = cutoffInstant(d, cfg.cutoff);
                  const missed = work && !e && new Date() > due, late = !!e && e.at > due;
                  return [<td key={`${p.id}s`}><a href={`/admin/reports?kind=start&who=${p.id}&day=${d}`}>{s ? istTime(s.at) : "—"}</a></td>,
                    <td key={`${p.id}e`} style={missed ? { color: "#c0392b", fontWeight: 600 } : late ? { color: "#b26a00" } : undefined}>
                      <a href={`/admin/reports?kind=end&who=${p.id}&day=${d}`} style={{ color: "inherit" }}>{e ? `${istTime(e.at)}${late ? " (late)" : ""}` : missed ? "Missed" : "—"}</a>
                      {e?.note && <div className="fine" style={{ maxWidth: 260 }}>{e.note}</div>}</td>];
                })}</tr>);
              })}</tbody></table></div>) : <p>No one is set to send a day report yet. Choose them below.</p>}
        </section>)}

      {sup && (
        <details className="adm-card" id="settings" style={{ marginTop: 18 }}><summary><b>Settings</b> <span className="fine">· who sends, who receives, the cut-off</span></summary>
          <form action={saveSettings} className="form" style={{ marginTop: 10 }}>
            <fieldset><legend className="fine">Who sends a daily report</legend>
              {people.map((p) => <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="from" value={p.id} defaultChecked={cfg.from.includes(p.id)} /> {p.name} <span className="fine">{p.email}</span></label>)}
            </fieldset>
            <label>Reports and reminders are emailed to<input name="to" defaultValue={cfg.to.join(", ")} placeholder="pratik@sintracap.in" /></label>
            <label>End-of-day cut-off (IST)<input type="time" name="cutoff" defaultValue={cfg.cutoff} /></label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="saturdays" defaultChecked={cfg.saturdays} /> Saturdays are working days</label>
            <p className="fine">The cut-off email runs once each evening at about 7:30 PM IST, and the morning one with the 9 AM run. A different cut-off changes what counts as late, not when the email goes.</p>
            <div><button className="btn sm" type="submit">Save</button></div>
          </form>
        </details>)}
    </>
  );
}
