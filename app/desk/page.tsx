import { and, desc, sql } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { audit } from "@/db/schema";
import { isSuper, ROLE_LABEL, type DeskRole } from "@/lib/perm";
import { myDesk, names } from "@/lib/desk";
import { stageLabel, istDay } from "@/lib/stages";
import { DkHead, DkToast, DkTask, DkEmpty, Ico, ICONS, ago } from "@/components/DeskApp";

type P = { searchParams: Promise<{ msg?: string }> };

export default async function Today({ searchParams }: P) {
  const me = await requireDesk();
  const { msg } = await searchParams;
  const db = await getDb();
  // An analyst sees office activity and their own desk actions; a super admin sees everything (as in the Log).
  const scope = isSuper(me) ? sql`true` : sql`(${audit.officeId} is not null or ${audit.userId} = ${me.id})`;
  const [d, nm, feed] = await Promise.all([
    myDesk(me),
    names(me),
    db.select().from(audit).where(and(scope, sql`(${audit.entity} is not null or ${audit.officeId} is not null) and ${audit.action} <> 'Signed in'`)).orderBy(desc(audit.at)).limit(12),
  ]);
  const today = istDay();
  const open = d.myTasks.filter((t) => t.status === "open");
  const dueNow = open.filter((t) => t.dueOn && t.dueOn <= today);
  const later = open.filter((t) => !t.dueOn || t.dueOn > today).slice(0, 5);
  const about = (t: (typeof open)[number]) => t.officeId && nm.office.get(t.officeId) ? { href: `/desk/investors/${t.officeId}`, label: nm.office.get(t.officeId)! }
    : t.dealId && nm.deal.get(t.dealId) ? { href: `/desk/deals/${t.dealId}`, label: nm.deal.get(t.dealId)!.company } : null;
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <>
      <DkToast msg={msg} />
      <DkHead title={`${hello}, ${me.name.split(" ")[0]}`} sub={`${ROLE_LABEL[me.role as DeskRole]} · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}`}
        action={<a className="dk-iconbtn" href="/notifications" aria-label="Notifications"><Ico d={ICONS.bell} /></a>} />

      <div className="dk-stats">
        <a href="/desk/tasks"><b>{open.length}</b><span>Open tasks</span></a>
        <a href="/desk/tasks" className={dueNow.length ? "warn" : ""}><b>{dueNow.length}</b><span>Due or overdue</span></a>
        <a href="/desk/investors?show=pending" className={d.pending.length ? "warn" : ""}><b>{d.pending.length}</b><span>To approve</span></a>
      </div>

      <section className="dk-sec">
        <h2>Due now</h2>
        {dueNow.length ? <ul className="dk-list">{dueNow.map((t) => <DkTask key={t.id} t={t} back="/desk" about={about(t)} />)}</ul>
          : <DkEmpty>Nothing due today.{later.length ? " Coming up below." : ""}</DkEmpty>}
        {later.length > 0 && <>
          <h3 className="dk-sub">Coming up</h3>
          <ul className="dk-list">{later.map((t) => <DkTask key={t.id} t={t} back="/desk" about={about(t)} />)}</ul>
        </>}
        <a className="dk-more" href="/desk/tasks">All tasks <Ico d={ICONS.chevron} size={16} /></a>
      </section>

      {d.pending.length > 0 && (
        <section className="dk-sec">
          <h2>Waiting for approval</h2>
          <ul className="dk-list">{d.pending.map((o) => (
            <li key={o.id}><a className="dk-row" href={`/desk/investors/${o.id}`}>
              <span className="dk-av" aria-hidden="true">{o.name.slice(0, 1)}</span>
              <span className="dk-row-main"><b>{o.name}</b><small>{o.investorType.replace("_", " ")} · registered {ago(o.createdAt)}</small></span>
              <Ico d={ICONS.chevron} size={18} />
            </a></li>))}</ul>
        </section>
      )}

      <section className="dk-sec">
        <h2>Your deals</h2>
        {d.mine.length ? <ul className="dk-list">{d.mine.map((x) => (
          <li key={x.id}><a className="dk-row" href={`/desk/deals/${x.id}`}>
            <span className="dk-row-main"><b>{x.company}</b><small>{x.listed ? "Listed company" : "Pre-IPO"}</small></span>
            <span className="dk-stage">{stageLabel(x.pipelineStage)}</span>
          </a></li>))}</ul>
          : <DkEmpty>No deals are assigned to you. {d.unowned.length ? `${d.unowned.length} have no owner yet.` : ""}</DkEmpty>}
        <a className="dk-more" href="/desk/pipeline">Pipeline <Ico d={ICONS.chevron} size={16} /></a>
      </section>

      <section className="dk-sec">
        <h2>Recent activity</h2>
        {feed.length ? <ul className="dk-feed">{feed.map((a) => (
          <li key={a.id}><span className="dk-dot" aria-hidden="true" /><div><p>{a.who ? <b>{a.who}: </b> : null}{a.action}</p><small>{ago(a.at)}</small></div></li>))}</ul>
          : <DkEmpty>Nothing yet.</DkEmpty>}
      </section>

      <a className="dk-console" href="/admin"><Ico d={ICONS.grid} size={18} /> Open the full console</a>
      <a className="dk-signout" href="/logout">Sign out</a>
    </>
  );
}
