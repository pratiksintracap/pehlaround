import { requireDesk } from "@/lib/auth";
import { can, mask } from "@/lib/perm";
import { getSettings } from "@/lib/settings";
import { desc, eq, isNull, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { calls, deals, interests, leads, offices, passes, questions, users } from "@/db/schema";
import { answerQuestion, saveCall, saveInterest, saveLead } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

export default async function Activity({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const me = await requireDesk();
  const { msg } = await searchParams;
  const confirm = can(me, "allocations.confirm"), seeContacts = can(me, "contacts.view", { analystContacts: (await getSettings()).analystContacts });
  const em = (v?: string | null) => (seeContacts ? v : mask(v));
  const db = await getDb();
  const [ds, os, us, ins, ps, qs, cs, ls] = await Promise.all([
    db.select({ id: deals.id, company: deals.company }).from(deals), db.select({ id: offices.id, name: offices.name }).from(offices),
    db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users),
    db.select().from(interests).orderBy(desc(interests.createdAt)), db.select().from(passes).orderBy(desc(passes.createdAt)).limit(100),
    db.select().from(questions).where(and(isNull(questions.answer), eq(questions.hidden, false))).orderBy(desc(questions.askedAt)),
    db.select().from(calls).where(eq(calls.kind, "request")).orderBy(desc(calls.createdAt)), db.select().from(leads).orderBy(desc(leads.createdAt)),
  ]);
  const deal = new Map(ds.map((x) => [x.id, x.company])), office = new Map(os.map((x) => [x.id, x.name])), user = new Map(us.map((x) => [x.id, x]));
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Requests and Q&amp;A</h1>

      <h2>Allocation requests</h2>
      <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>When</th><th>Office · person</th><th>Deal</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        {ins.length ? ins.map((i) => { const u = user.get(i.userId); return (
          <tr key={i.id}><td>{fmtD(i.createdAt)}</td><td>{office.get(i.officeId)}<br /><small className="fine">{u?.name} · {em(u?.email)} · {em(u?.phone)}</small></td><td>{deal.get(i.dealId)}</td>
            <td>₹{Number(i.amountCr)} Cr{i.colead ? " · co-lead" : ""}</td>
            <td>{!confirm ? <><span className="pill">{i.status}</span>{i.note ? <><br /><small className="fine">{i.note}</small></> : null}<br /><small className="fine">A super admin confirms allocations.</small></> : <form action={saveInterest} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><input type="hidden" name="id" value={i.id} />
              <select name="status" defaultValue={i.status}>{["Indicated", "Term sheet", "Documents", "Allotted", "Withdrawn"].map((s) => <option key={s}>{s}</option>)}</select>
              <input name="note" defaultValue={i.note ?? ""} placeholder="Note" style={{ maxWidth: 160 }} /><button className="btn sm" type="submit">Save</button></form>}</td></tr>); })
          : <tr><td colSpan={5} className="fine">None yet.</td></tr>}
      </tbody></table></div>

      <h2 id="qs">Questions waiting for an answer</h2>
      {qs.length ? qs.map((q) => (
        <form key={q.id} action={answerQuestion} className="form adm-card"><input type="hidden" name="id" value={q.id} /><input type="hidden" name="back" value="/admin/activity#qs" />
          <p className="fine">{deal.get(q.dealId)} · {q.officeId ? office.get(q.officeId) : "desk"} · {fmtD(q.askedAt)}{q.private && <> · <span className="pill mid">Private to this office</span></>}</p>
          <label>Question<input name="question" defaultValue={q.question} /></label>
          {q.draftAnswer && <p className="notice" style={{ margin: 0 }}><b>The promoter drafted an answer</b> from the founder portal. It is filled in below: check it, edit if needed, and save to post it.</p>}
          <div className="row"><label>{q.private ? "Answer (shown only to the office that asked)" : "Answer (shown to every office in the room)"}<textarea name="answer" rows={q.draftAnswer ? 4 : 2} defaultValue={q.draftAnswer ?? ""} /></label><label>Answered by<input name="by" defaultValue="Promoter" /></label></div>
          <label className="chk"><input type="checkbox" name="hidden" /> Hide from the room</label>
          <div><button className="btn sm" type="submit">Save</button></div></form>))
        : <p className="fine">All questions are answered.</p>}

      <h2 id="calls">Call requests</h2>
      {cs.length ? cs.map((c) => (
        <form key={c.id} action={saveCall} className="form adm-card"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value="/admin/activity#calls" />
          <p className="fine">{deal.get(c.dealId)} · {c.officeId ? office.get(c.officeId) : ""} · {c.slot} · {c.attendees} · {fmtD(c.createdAt)}{c.questions ? ` · “${c.questions}”` : ""}</p>
          <div className="row"><label>Status<select name="status" defaultValue={c.status}><option>Requested</option><option>Scheduled</option><option>Held</option><option>Declined</option></select></label>
            <label>When<input name="scheduledFor" defaultValue={c.scheduledFor ?? ""} /></label></div>
          <label>Summary<textarea name="summary" rows={2} defaultValue={c.summary ?? ""} /></label>
          <div><button className="btn sm" type="submit">Save</button></div></form>))
        : <p className="fine">No call requests.</p>}

      <h2>Passes</h2>
      <ul className="feed">{ps.length ? ps.map((p) => <li key={p.id}><span className="mono">{fmtD(p.createdAt)}</span>{office.get(p.officeId)} passed on {deal.get(p.dealId)}: “{p.reason}{p.note ? ` · ${p.note}` : ""}”</li>) : <li className="empty-li">None.</li>}</ul>

      <h2 id="leads">Founder leads and data requests</h2>
      <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>When</th><th>Type</th><th>Who</th><th>Details</th><th>Status</th></tr></thead><tbody>
        {ls.length ? ls.map((l) => (
          <tr key={l.id}><td>{fmtD(l.createdAt)}</td><td>{l.kind === "deletion" ? "Data deletion" : "Founder"}</td><td>{l.name} · {l.company}<br /><small className="fine">{l.email} · {l.phone}</small></td>
            <td><small>{Object.entries(l.data || {}).filter(([k, v]) => v && !["nda", "risk", "officeId", "report"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(" · ")}</small>
              {(l.data as Record<string, string> | null)?.report && <details className="lead-rep"><summary>Readiness report</summary><pre>{(l.data as Record<string, string>).report}</pre></details>}</td>
            <td><form action={saveLead} style={{ display: "flex", gap: 6 }}><input type="hidden" name="id" value={l.id} /><select name="status" defaultValue={l.status}>{["New", "Contacted", "In diligence", "Closed"].map((s) => <option key={s}>{s}</option>)}</select><button className="btn sm" type="submit">Save</button></form></td></tr>))
          : <tr><td colSpan={5} className="fine">None yet.</td></tr>}
      </tbody></table></div>
    </>
  );
}
