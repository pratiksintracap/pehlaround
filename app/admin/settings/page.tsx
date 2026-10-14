import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveSiteSettings } from "@/lib/admin-actions";
import { emailReady } from "@/lib/notify";
import { aiReady } from "@/lib/ai";
import { Msg } from "@/components/AdminBits";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const st = await getSettings();
  const mail = emailReady();
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Settings</h1>
      <form action={saveSiteSettings} className="form chart" style={{ maxWidth: 720 }}>
        <span className="k eyebrow">Who sees what</span>
        <label className="check"><input type="checkbox" name="requireApproval" defaultChecked={st.requireApproval} /> <span><b>Approve each office before it sees company names</b><br /><small className="fine">On: a new registration sees the anonymised shelf until you approve it in Offices. Off: every registered office sees names and can sign NDAs straight away.</small></span></label>
        <span className="k eyebrow" style={{ marginTop: 14 }}>Announcement across the site</span>
        <label>Text (leave empty for none)<input name="announcement" maxLength={300} defaultValue={st.announcement} placeholder="Krasny's round closes on 31 October" /></label>
        <label>Link (optional)<input name="announcementLink" maxLength={500} defaultValue={st.announcementLink} placeholder="/deals/krasny" /></label>
        <span className="k eyebrow" style={{ marginTop: 14 }}>What the desk commits to</span>
        <label>Shown to every office on its dashboard. One per line, as <code>Promise | one-line detail</code>; up to eight.<textarea name="promises" rows={7} maxLength={3000} defaultValue={st.promises} style={{ fontSize: 13.5 }} /></label>
        <p className="fine">Questions answered within 48 hours is checked against the rooms: once three or more are answered in 90 days, the dashboard shows the real median time beside it.</p>
        <span className="k eyebrow" style={{ marginTop: 14 }}>AI analyst</span>
        <label className="check"><input type="checkbox" name="aiAnalyst" defaultChecked={st.aiAnalyst} /> <span><b>Offer the AI analyst to approved offices</b><br /><small className="fine">A chat in the dashboard and every room that answers from the rooms the office has signed for, and from the web for peers and sectors. Conversations are kept on the office&apos;s record; you can read them under Requests and Q&amp;A. {aiReady() ? "The Claude API key is set." : "Needs ANTHROPIC_API_KEY in Vercel's environment variables before it appears."}</small></span></label>
        <label>Monthly budget for the analyst, US$ (0 for no cap)<input name="aiBudget" type="number" min={0} step={10} defaultValue={st.aiBudget} style={{ maxWidth: 160 }} /><span className="hint">Estimated from tokens and web searches at list price. When it is reached, the analyst tells offices it is back on the 1st. Match it to your Console spend limit or monthly credits.</span></label>
        <span className="k eyebrow" style={{ marginTop: 14 }}>Desk team</span>
        <label className="check"><input type="checkbox" name="analystContacts" defaultChecked={st.analystContacts} /> <span><b>Analysts can see office people&apos;s email and phone</b><br /><small className="fine">Off: analysts see office names and activity, with contact details masked. Super admins always see them. Roles are set in <a href="/admin/team">Desk team</a>.</small></span></label>
        <span className="k eyebrow" style={{ marginTop: 14 }}>New offices</span>
        <label>What new offices are told about approval<input name="approvalTime" maxLength={120} defaultValue={st.approvalTime} /><span className="hint">Shown on registration, the deal page and the dashboard, e.g. &quot;usually within two hours on working days&quot;.</span></label>
        <label className="check"><input type="checkbox" name="referrals" defaultChecked={st.referrals} /> <span><b>Approve offices referred by an approved office</b><br /><small className="fine">Offices refer peers from their dashboard (five every 30 days). Off: referred offices wait for your approval like anyone else.</small></span></label>
        <span className="k eyebrow" style={{ marginTop: 14 }}>Desk alerts</span>
        <label>Email new registrations, NDAs, questions and requests to<input name="notifyDeskEmail" type="email" defaultValue={st.notifyDeskEmail} placeholder="desk@offmarketdesk.in" /></label>
        <p className="fine">{mail ? "Email is set up." : "Email is not set up yet: alerts show on the admin overview only. To switch email on, add RESEND_API_KEY (and EMAIL_FROM, for example Off Market Desk <desk@offmarketdesk.in>) in Vercel's environment variables and redeploy."}</p>
        <div><button className="btn primary" type="submit">Save settings</button></div>
      </form>
    </>
  );
}
