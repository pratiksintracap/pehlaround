import { requireAdmin } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emailQueue, offices, users } from "@/db/schema";
import { SERIES, preview, queueStats } from "@/lib/onboarding";
import { getSettings } from "@/lib/settings";
import { emailReady } from "@/lib/email";
import { setOnboardingEmails, sendTestOnboarding, backfillOnboarding } from "@/lib/admin-actions";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const when = (s: (typeof SERIES)[number]) => (s.days === 0 ? `On ${s.anchor === "register" ? "registration" : "approval"}, straight away` : `Day ${s.days} after approval, 9 AM IST`);

export default async function Emails() {
  await requireAdmin();
  const st = await getSettings();
  const mail = emailReady();
  const stats = await queueStats();
  const previews = await Promise.all(SERIES.map((s) => preview(s.key)));
  const db = await getDb();
  const recent = await db.select({ q: emailQueue, name: users.name, office: offices.name }).from(emailQueue)
    .leftJoin(users, eq(users.id, emailQueue.userId)).leftJoin(offices, eq(offices.id, emailQueue.officeId))
    .orderBy(desc(emailQueue.sendAt)).limit(40);
  const name = new Map(SERIES.map((s) => [s.key, s.name]));
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Onboarding emails</h1>
      <p className="fine" style={{ marginBottom: 14, maxWidth: 760 }}>
        Every new family office gets this series. Welcome goes on registration; the rest are timed from approval and go at 9 AM IST.
        A step is skipped when the office has already done what it asks (signed an NDA, requested an allocation) or has turned email off.
        Emails name no company: deals appear with their anonymised titles and Desk Score.</p>
      <div className="chart" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <span><b>{st.onboardingEmails ? "On" : "Paused"}</b> · {mail ? "email is set up" : "email is not set up yet: emails wait in the queue until RESEND_API_KEY is added in Vercel (anything over 4 days old is then skipped)"}</span>
        <form action={setOnboardingEmails}><input type="hidden" name="on" value={st.onboardingEmails ? "0" : "1"} />
          <button className="btn sm" type="submit">{st.onboardingEmails ? "Pause the series" : "Switch the series on"}</button></form>
        <form action={backfillOnboarding}><button className="btn sm" type="submit">Queue for offices approved earlier</button></form>
      </div>
      <div className="cmpwrap"><table className="cmp plain">
        <thead><tr><th>Email</th><th>When</th><th>Purpose</th><th>Skipped if</th><th>Sent</th><th>Skipped</th><th>Waiting</th></tr></thead>
        <tbody>{SERIES.map((s) => { const k = stats.get(s.key) || {}; return (
          <tr key={s.key}><td><a href={`#${s.key}`}><b>{s.name}</b></a></td><td>{when(s)}</td><td>{s.purpose}</td>
            <td className="fine">{s.key === "welcome" ? "Already approved" : s.key === "first_room" ? "Signed an NDA" : s.key === "personal" ? "Requested an allocation" : "—"}</td>
            <td>{k.sent ?? 0}</td><td>{k.skipped ?? 0}</td><td>{k.pending ?? 0}</td></tr>); })}</tbody>
      </table></div>

      <h2 style={{ fontSize: 22, margin: "26px 0 10px" }}>Previews</h2>
      <p className="fine" style={{ marginBottom: 12 }}>Shown with a sample office, Shah Family Office, and the deals on the desk today.</p>
      {previews.map((p) => p && (
        <section key={p.step.key} id={p.step.key} className="chart" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <div><span className="k">{when(p.step)}</span><br /><b>{p.subject}</b></div>
            <form action={sendTestOnboarding}><input type="hidden" name="key" value={p.step.key} />
              <button className="btn sm" type="submit" disabled={!mail}>Send me a test</button></form>
          </div>
          <iframe title={p.step.name} srcDoc={p.html} sandbox="" style={{ width: "100%", height: 560, border: "1px solid var(--line, #dde2ee)", borderRadius: 10, marginTop: 10, background: "#fff" }} />
        </section>))}

      <h2 style={{ fontSize: 22, margin: "26px 0 10px" }}>Latest in the queue</h2>
      {recent.length ? <div className="cmpwrap"><table className="cmp plain">
        <thead><tr><th>Due</th><th>Person</th><th>Office</th><th>Email</th><th>Status</th></tr></thead>
        <tbody>{recent.map(({ q, name: n, office }) => (
          <tr key={q.id}><td className="mono">{fmtT(q.sendAt)}</td><td>{n}</td><td>{office}</td><td>{name.get(q.step) || q.step}</td>
            <td>{q.status === "pending" ? "Waiting" : q.status === "sent" ? `Sent ${q.sentAt ? fmtT(q.sentAt) : ""}` : `Skipped: ${q.reason}`}</td></tr>))}</tbody>
      </table></div> : <p className="fine">Nothing queued yet. The series starts with the next registration or approval.</p>}
    </>
  );
}
