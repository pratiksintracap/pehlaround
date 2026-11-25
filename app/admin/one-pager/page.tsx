// The desk one-pager (lib/onepager.ts): what moved since the last one, what is stuck, interest, team and sourcing.
// Emailed with a PDF on the chosen days by the 9 AM run; here it can be read for any day and the days changed. Super admin.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { istDay } from "@/lib/stages";
import { buildOnePager, onePagerSettings, saveOnePagerSettings } from "@/lib/onepager";
import { prettyDay, reportSettings } from "@/lib/day-report";

export const dynamic = "force-dynamic";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function save(f: FormData) {
  "use server";
  await requireAdmin();
  await saveOnePagerSettings({ days: f.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6) });
  revalidatePath("/admin/one-pager");
  redirect("/admin/one-pager?msg=" + encodeURIComponent("One-pager days saved."));
}

export default async function OnePagerPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = istDay();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day || "") && sp.day! <= today ? sp.day! : today;
  const [p, cfg, rs] = await Promise.all([buildOnePager(day), onePagerSettings(), reportSettings()]);
  return (
    <>
      <h1>Desk one-pager</h1>
      <p className="fine">Emailed with a PDF at 9 AM on {cfg.days.length ? cfg.days.map((d) => DAYS[d]).join(", ") : "no days (switched off)"} to {rs.to.join(", ") || "the report recipients"}. Each one covers what happened since the previous one. Built from the portal only.</p>
      <form className="adm-filter" action="/admin/one-pager" style={{ alignItems: "center" }}>
        <label className="fine">Day <input type="date" name="day" defaultValue={day} max={today} /></label> <button className="btn sm" type="submit">Show</button>
        <a className="btn sm" href={`/api/admin/one-pager?day=${day}`} download>Download PDF</a>
      </form>
      <section className="adm-card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 2px" }}>{prettyDay(p.day)}</h2>
        <p className="fine" style={{ margin: "0 0 12px" }}>Since {prettyDay(p.since)}.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
          {p.numbers.map((n) => <div key={n.k} className="chart" style={{ padding: 10 }}><span className="k">{n.k}</span><div style={{ fontSize: 22, fontWeight: 700 }}>{n.v}</div>{n.s && <div className="fine">{n.s}</div>}</div>)}
        </div>
        {p.sections.map((s) => (
          <div key={s.title} style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>{s.title}</h3>
            {s.lines.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{s.lines.map((l, i) => <li key={i} style={l.warn ? { color: "#b42318" } : undefined}>{l.text}{l.sub && <span className="fine"> · {l.sub}</span>}</li>)}</ul> : <p className="fine">{s.empty}</p>}
          </div>))}
      </section>
      <details className="adm-card" style={{ marginTop: 18 }}><summary><b>Days</b> <span className="fine">· when it is emailed</span></summary>
        <form action={save} className="form" style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{DAYS.map((d, i) => <label key={d} style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="days" value={i} defaultChecked={cfg.days.includes(i)} />{d}</label>)}</div>
          <p className="fine">Recipients are the same as the day report's (Day report → Settings).</p>
          <div><button className="btn sm" type="submit">Save</button></div>
        </form></details>
    </>
  );
}
