import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deals, deskNotes, ndas, offices, users } from "@/db/schema";
import { can, mask } from "@/lib/perm";
import { getSettings } from "@/lib/settings";
import { canSeeOffice, deskMembers, listTasks } from "@/lib/desk";
import { saveDeskNote } from "@/lib/desk-actions";
import { setApproval } from "@/lib/admin-actions";
import { DkToast, DkTask, DkAddTask, DkEmpty, Ico, ICONS, ago, shortDay } from "@/components/DeskApp";

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> };
const TYPE: Record<string, string> = { family_office: "Family office", fund: "Fund", individual: "Individual" };

/** WhatsApp wants the number with its country code and no symbols; a bare 10-digit Indian mobile gets 91. */
const wa = (p: string) => { const d = p.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d.replace(/^0+/, ""); };

export default async function Investor({ params, searchParams }: P) {
  const me = await requireDesk();
  const [{ id: raw }, { msg }] = await Promise.all([params, searchParams]);
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = await getDb();
  const [o] = await db.select().from(offices).where(eq(offices.id, id));
  // A desk-added investor is private to whoever added it (the super admin sees all): anyone else gets a plain 404.
  if (!o || !canSeeOffice(me, o)) notFound();
  const back = `/desk/investors/${o.id}`;
  const [people, notes, tasks, signed, members, st] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, officeRole: users.officeRole, lastLoginAt: users.lastLoginAt })
      .from(users).where(and(eq(users.officeId, o.id), eq(users.disabled, false))),
    db.select().from(deskNotes).where(eq(deskNotes.officeId, o.id)).orderBy(desc(deskNotes.createdAt)).limit(50),
    listTasks({ officeId: o.id, status: "all", me }),
    db.select({ company: deals.company, signedAt: ndas.signedAt, listed: deals.listed }).from(ndas).innerJoin(deals, eq(deals.id, ndas.dealId))
      .where(eq(ndas.officeId, o.id)).orderBy(desc(ndas.signedAt)),
    deskMembers(),
    getSettings(),
  ]);
  // Office people's contact details follow the console's rule: analysts see them only if Settings allows.
  // The contact on an investor the desk added belongs to whoever added it, so it is always shown to them.
  const seeContacts = can(me, "contacts.view", { analystContacts: st.analystContacts });
  const show = (v?: string | null) => (seeContacts ? v : mask(v));
  const contacts = o.origin === "desk"
    ? (o.contactName || o.contactEmail || o.contactPhone ? [{ key: "c", name: o.contactName || o.name, role: "Contact", email: o.contactEmail, phone: o.contactPhone, masked: false }] : [])
    : people.map((u) => ({ key: `u${u.id}`, name: u.name, role: u.officeRole || "", email: show(u.email), phone: show(u.phone), masked: !seeContacts }));
  const work = can(me, "workflow");
  const open = tasks.filter((t) => t.status === "open"), done = tasks.filter((t) => t.status === "done").slice(0, 5);
  const who = (uid: number | null) => members.find((m) => m.id === uid)?.name.split(" ")[0];
  // Tasks about a private investor go only to people who can see it.
  const assignees = members.filter((m) => canSeeOffice(m, o)).map((m) => ({ id: m.id, name: m.name }));
  return (
    <>
      <DkToast msg={msg} />
      <a className="dk-back" href="/desk/investors"><Ico d="M15 6l-6 6 6 6" size={18} /> Investors</a>
      <header className="dk-hero">
        <span className="dk-av lg" aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
        <h1>{o.name}</h1>
        <p>{[TYPE[o.investorType] ?? "Investor", o.city, o.ticket ? `Ticket ${o.ticket}` : ""].filter(Boolean).join(" · ")}</p>
        <div className="dk-tags">
          {o.approval === "pending" ? <span className="dk-pill mid">Awaiting approval</span> : o.approval === "rejected" ? <span className="dk-pill bad">Declined</span> : <span className="dk-pill ok">Approved</span>}
          {o.origin === "desk" ? <span className="dk-pill">Added by {o.addedBy || "the desk"}</span> : <span className="dk-pill">Registered {shortDay(o.createdAt)}</span>}
        </div>
      </header>

      {o.approval === "pending" && can(me, "offices.approve") && (
        <div className="dk-approve">
          <form action={setApproval}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="approval" value="approved" /><input type="hidden" name="back" value={back} />
            <button className="dk-btn primary" type="submit">Approve</button></form>
          <form action={setApproval}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="approval" value="rejected" /><input type="hidden" name="back" value={back} />
            <button className="dk-btn ghost" type="submit">Decline</button></form>
        </div>
      )}

      <section className="dk-sec">
        <h2>People</h2>
        {contacts.length ? <ul className="dk-people">{contacts.map((c) => (
          <li key={c.key}>
            <div><b>{c.name}</b>{c.role ? <small>{c.role}</small> : null}</div>
            <div className="dk-acts">
              {c.phone && !c.masked ? <a className="dk-act" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${c.name}`}><Ico d={ICONS.phone} /><span>Call</span></a> : null}
              {c.phone && !c.masked ? <a className="dk-act" href={`https://wa.me/${wa(c.phone)}`} aria-label={`WhatsApp ${c.name}`}><Ico d={ICONS.chat} /><span>WhatsApp</span></a> : null}
              {c.email && !c.masked ? <a className="dk-act" href={`mailto:${c.email}`} aria-label={`Email ${c.name}`}><Ico d={ICONS.mail} /><span>Email</span></a> : null}
              {c.masked ? <small className="fine">{[c.email, c.phone].filter(Boolean).join(" · ")}</small> : null}
            </div>
          </li>))}</ul>
          : <DkEmpty>No contact on file. {o.origin === "desk" ? <a href={`/admin/offices?show=desk#o${o.id}`}>Add one</a> : null}</DkEmpty>}
      </section>

      <section className="dk-sec">
        <h2>Tasks <span className="dk-count">{open.length}</span></h2>
        {open.length ? <ul className="dk-list">{open.map((t) => <DkTask key={t.id} t={t} back={back} who={who(t.assigneeId)} />)}</ul> : <DkEmpty>No open tasks.</DkEmpty>}
        {work && <DkAddTask back={back} officeId={o.id} assignees={assignees} me={me.id} />}
        {done.length > 0 && <details className="dk-done"><summary>Done ({done.length})</summary>
          <ul className="dk-list">{done.map((t) => <DkTask key={t.id} t={t} back={back} who={who(t.assigneeId)} />)}</ul></details>}
      </section>

      <section className="dk-sec">
        <h2>Notes <span className="dk-count">{notes.length}</span></h2>
        {work && (
          <form action={saveDeskNote} className="dk-note-form">
            <input type="hidden" name="officeId" value={o.id} /><input type="hidden" name="back" value={back} />
            <label className="sr-only" htmlFor="dk-note">New note</label>
            <textarea id="dk-note" name="body" rows={3} required maxLength={8000} placeholder="Call notes, what they want, what to send next…" />
            <button className="dk-btn" type="submit">Save note</button>
          </form>
        )}
        {notes.length ? <ul className="dk-notes">{notes.map((n) => (
          <li key={n.id}><p>{n.body}</p><small>{n.who || "Desk"} · {ago(n.createdAt)}{n.editedAt ? " · edited" : ""}</small></li>))}</ul>
          : <DkEmpty>No notes yet.</DkEmpty>}
        {o.notes ? <div className="dk-oldnote"><small>Office notes</small><p>{o.notes}</p></div> : null}
      </section>

      {signed.length > 0 && (
        <section className="dk-sec">
          <h2>NDAs signed</h2>
          <ul className="dk-list">{signed.map((s, i) => <li key={i} className="dk-row plain"><span className="dk-row-main"><b>{s.company}</b><small>{shortDay(s.signedAt)}</small></span></li>)}</ul>
        </section>
      )}

      <a className="dk-console" href={`/admin/offices${o.origin === "desk" ? "?show=desk" : ""}#o${o.id}`}><Ico d={ICONS.grid} size={18} /> Open in the full console</a>
    </>
  );
}
