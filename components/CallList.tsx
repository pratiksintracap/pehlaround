import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offices, users } from "@/db/schema";
import type { CallRow } from "@/lib/call-list";
import { Ico, ICONS, ago } from "@/components/DeskApp";

/** WhatsApp wants the number with its country code and no symbols; a bare 10-digit Indian mobile gets 91. */
const wa = (p: string) => { const d = p.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d.replace(/^0+/, ""); };

/** The ranked call list as desk rows, with call and WhatsApp buttons when the viewer may see contact details. */
export async function CallListRows({ rows, contacts }: { rows: CallRow[]; contacts: boolean }) {
  const ids = rows.map((r) => r.officeId);
  const phone = new Map<number, { name: string; phone: string }>();
  if (contacts && ids.length) {
    const db = await getDb();
    const [us, os] = await Promise.all([
      db.select({ officeId: users.officeId, name: users.name, phone: users.phone, lastLoginAt: users.lastLoginAt }).from(users).where(and(inArray(users.officeId, ids), eq(users.disabled, false))),
      db.select({ id: offices.id, contactName: offices.contactName, contactPhone: offices.contactPhone }).from(offices).where(inArray(offices.id, ids)),
    ]);
    // the person who signed in most recently, else the desk's own contact on the office
    for (const u of us.filter((x) => x.phone).sort((a, b) => +(b.lastLoginAt ?? 0) - +(a.lastLoginAt ?? 0))) if (u.officeId && !phone.has(u.officeId)) phone.set(u.officeId, { name: u.name, phone: u.phone! });
    for (const o of os) if (!phone.has(o.id) && o.contactPhone) phone.set(o.id, { name: o.contactName || "", phone: o.contactPhone });
  }
  return (
    <ul className="dk-list dk-calls">{rows.map((r) => {
      const p = phone.get(r.officeId);
      return (
        <li key={r.officeId} className="dk-call-row">
          <a className="dk-row" href={`/desk/investors/${r.officeId}`}>
            <span className="dk-av" aria-hidden="true">{r.name.slice(0, 1).toUpperCase()}</span>
            <span className="dk-row-main"><b>{r.name}</b><small>{r.reasons[0].text}</small>
              {r.reasons.length > 1 && <small className="dk-more-why">{r.reasons.slice(1, 3).map((x) => x.text).join(" · ")}</small>}
              {r.contacted && <small className="dk-spoke">Noted {ago(r.contacted)}</small>}</span>
            <Ico d={ICONS.chevron} size={18} />
          </a>
          {p && <div className="dk-acts">
            <a className="dk-act" href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${p.name || r.name}`}><Ico d={ICONS.phone} /><span>Call{p.name ? ` ${p.name.split(" ")[0]}` : ""}</span></a>
            <a className="dk-act" href={`https://wa.me/${wa(p.phone)}`} aria-label={`WhatsApp ${p.name || r.name}`}><Ico d={ICONS.chat} /><span>WhatsApp</span></a>
          </div>}
        </li>);
    })}</ul>
  );
}
