import { desc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { addDeskMember, setDeskRole, removeDeskMember } from "@/lib/admin-actions";
import { DESK_ROLES, ROLE_LABEL, type DeskRole } from "@/lib/perm";
import { Msg } from "@/components/AdminBits";

const fmtD = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "never");

const CAN: [string, boolean, boolean][] = [
  ["Approve or decline family offices", true, true],
  ["Create and edit deals, documents, Q&A and calls", true, true],
  ["Keep a deal in preparation (desk only), publish it, open or close its room", true, true],
  ["Work founder leads and support tickets", true, true],
  ["Read the AI analyst's conversations", true, true],
  ["Draft articles and messages to offices", true, true],
  ["See office people's email and phone", true, false],
  ["Publish an article", true, false],
  ["Send messages to all offices", true, false],
  ["Confirm allocations", true, false],
  ["Delete documents and articles", true, false],
  ["Reset passwords, disable people, revoke NDAs, put offices on hold", true, false],
  ["Invite offices, onboarding emails, site settings", true, false],
  ["Manage the desk team; see every desk member's actions", true, false],
];

export default async function Team({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const me = await requireAdmin();
  const { msg } = await searchParams;
  const db = await getDb();
  const desk = await db.select().from(users).where(sql`role in ('admin', 'analyst') and disabled = false`).orderBy(desc(sql`role = 'admin'`), users.name);
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Desk team</h1>
      <p className="fine" style={{ marginBottom: 16 }}>Super admins can do everything. Analysts run the day-to-day work; anything that reaches every investor, or can&apos;t be undone, comes to a super admin. Every desk action is in the <a href="/admin/log">audit log</a> with a name.</p>
      <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Name</th><th>Email</th><th>Last sign-in</th><th>Role</th><th /></tr></thead><tbody>
        {desk.map((u) => (
          <tr key={u.id}><th scope="row">{u.name}{u.id === me.id ? " (you)" : ""}</th><td>{u.email}</td><td>{fmtD(u.lastLoginAt)}</td>
            <td>{u.id === me.id ? ROLE_LABEL[u.role as DeskRole] : (
              <form action={setDeskRole} style={{ display: "flex", gap: 6 }}><input type="hidden" name="id" value={u.id} />
                <select name="role" defaultValue={u.role} aria-label={`Role for ${u.name}`}>{DESK_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                <button className="btn sm" type="submit">Save</button></form>)}</td>
            <td>{u.id !== me.id && <form action={removeDeskMember}><input type="hidden" name="id" value={u.id} /><button className="btn sm ghost" type="submit">Remove from the desk</button></form>}</td></tr>))}
      </tbody></table></div>

      <div className="two" style={{ marginTop: 24 }}>
        <form action={addDeskMember} className="form chart" id="add">
          <span className="k">Add someone to the desk</span>
          <div className="row"><label>Name<input name="name" required maxLength={120} /></label><label>Work email<input name="email" type="email" required maxLength={200} /></label></div>
          <div className="row"><label>Role<select name="role" defaultValue="analyst">{DESK_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
            <label>Temporary password<input name="password" type="text" minLength={8} maxLength={200} autoComplete="off" placeholder="8 characters or more" /><span className="hint">Share it privately. Not needed if they already have an account.</span></label></div>
          <div><button className="btn primary" type="submit">Add to the desk</button></div>
        </form>
        <div className="chart"><span className="k">Who can do what</span>
          <div className="cmpwrap"><table className="cmp plain perm-t"><thead><tr><th /><th>Super admin</th><th>Analyst</th></tr></thead><tbody>
            {CAN.map(([t, a, b]) => <tr key={t}><td>{t}</td><td>{a ? "✓" : "—"}</td><td>{b ? "✓" : "—"}</td></tr>)}
          </tbody></table></div>
          <p className="fine" style={{ marginTop: 8 }}>Analysts can be allowed to see office contact details in <a href="/admin/settings">Settings</a>.</p></div>
      </div>
    </>
  );
}
