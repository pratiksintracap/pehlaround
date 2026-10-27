import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { getSettings } from "@/lib/settings";
import { callList } from "@/lib/call-list";
import { CallListRows } from "@/components/CallList";
import { DkHead, DkEmpty, Ico } from "@/components/DeskApp";

export default async function WhoToCall() {
  const me = await requireDesk();
  const [rows, st] = await Promise.all([callList(me, { limit: 30 }), getSettings()]);
  return (
    <>
      <a className="dk-back" href="/desk"><Ico d="M15 6l-6 6 6 6" size={18} /> Today</a>
      <DkHead title="Who to call today" sub="Ranked by what each office did on the site in the last two weeks. Anyone the desk noted in the last two days drops down the list." />
      <section className="dk-sec">
        {rows.length ? <CallListRows rows={rows} contacts={can(me, "contacts.view", { analystContacts: st.analystContacts })} />
          : <DkEmpty>Nobody stands out today. The list fills as offices read decks, sign NDAs and ask for allocations.</DkEmpty>}
      </section>
      <p className="fine" style={{ padding: "0 4px" }}>After a call, use “Log a call” on the investor&apos;s page so the next person knows, and the office drops down this list.</p>
    </>
  );
}
