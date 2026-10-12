import { requireAdmin } from "@/lib/auth";
import { desc, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, invites, ndas, offices, users } from "@/db/schema";
import { setOfficeStatus, saveOfficeNotes, resetPassword, toggleUser, revokeNda } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
const LABEL: Record<string, string> = { registered: "Registered", pan_submitted: "PAN to check", verified: "Verified", rejected: "On hold" };

export default async function Offices({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = await getDb();
  const [os, us, ns, ds, inv] = await Promise.all([
    db.select().from(offices).orderBy(desc(offices.createdAt)),
    db.select().from(users),
    db.select().from(ndas).orderBy(desc(ndas.signedAt)),
    db.select({ id: deals.id, company: deals.company }).from(deals),
    db.select().from(invites).where(isNull(invites.acceptedAt)),
  ]);
  const dealName = new Map(ds.map((d) => [d.id, d.company]));
  const order = (s: string) => ({ pan_submitted: 0, registered: 1, verified: 2, rejected: 3 }[s] ?? 4);
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Family offices</h1>
      <p className="fine" style={{ marginBottom: 16 }}>Check each PAN against the entity name (for example on the income-tax portal) and mark the office verified. Putting an office on hold closes every room to it.</p>
      {[...os].sort((a, b) => order(a.status) - order(b.status)).map((o) => {
        const people = us.filter((u) => u.officeId === o.id), nn = ns.filter((x) => x.officeId === o.id);
        return (
          <details key={o.id} className="adm-card" open={o.status === "pan_submitted"}>
            <summary><b>{o.name}</b> <span className={`pill ${o.status === "verified" ? "ok" : o.status === "pan_submitted" ? "mid" : o.status === "rejected" ? "off" : ""}`}>{LABEL[o.status] || o.status}</span>
              <span className="fine"> · {people.length} {people.length === 1 ? "person" : "people"} · {nn.length} NDAs · registered {fmtD(o.createdAt)}</span></summary>
            <div className="two">
              <div>
                <dl className="terms compact">
                  <div><dt>Investing entity</dt><dd>{o.entityName || "—"}</dd></div>
                  <div><dt>PAN</dt><dd className="mono">{o.pan || "—"}</dd></div>
                  <div><dt>Name typed at signing</dt><dd>{o.panName || "—"}</dd></div>
                  <div><dt>Invests as · residency</dt><dd>{o.category || "—"} · {o.residency || "—"}</dd></div>
                  <div><dt>Ticket</dt><dd>{o.ticket || "—"}</dd></div>
                  <div><dt>Consents</dt><dd>{Object.entries(o.consents || {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "—"}</dd></div>
                </dl>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {(["verified", "rejected", "pan_submitted"] as const).filter((st) => st !== o.status).map((st) => (
                    <form key={st} action={setOfficeStatus}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value={st} />
                      <button className={`btn sm ${st === "verified" ? "primary" : ""}`} type="submit">{st === "verified" ? "Mark PAN verified" : st === "rejected" ? "Put on hold" : "Back to PAN check"}</button></form>
                  ))}
                </div>
                <form action={saveOfficeNotes} className="form" style={{ marginTop: 10 }}><input type="hidden" name="id" value={o.id} />
                  <label>Desk notes<textarea name="notes" rows={2} defaultValue={o.notes || ""} /></label><div><button className="btn sm" type="submit">Save notes</button></div></form>
              </div>
              <div>
                <span className="k eyebrow">People</span>
                <ul className="feed">{people.map((u) => (
                  <li key={u.id}><b>{u.name}</b> · {u.email} · {u.phone || "—"} · {u.officeRole || "—"} · {u.rights}{u.disabled ? " · disabled" : ""}<br />
                    <small className="fine">last sign-in {fmtD(u.lastLoginAt)}</small>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      <form action={resetPassword} style={{ display: "flex", gap: 6 }}><input type="hidden" name="id" value={u.id} /><input name="password" placeholder="New password" minLength={8} required style={{ maxWidth: 160 }} /><button className="btn sm" type="submit">Reset</button></form>
                      <form action={toggleUser}><input type="hidden" name="id" value={u.id} /><button className="btn sm ghost" type="submit">{u.disabled ? "Enable" : "Disable"}</button></form>
                    </div></li>))}
                  {inv.filter((i) => i.officeId === o.id).map((i) => <li key={`i${i.id}`}>{i.email} · invited · {i.rights}</li>)}
                </ul>
                <span className="k eyebrow">NDAs</span>
                <ul className="feed">{nn.length ? nn.map((x) => (
                  <li key={x.id}>{dealName.get(x.dealId)} · {x.signerName} · {fmtD(x.signedAt)} · v{x.version}{x.revokedAt ? " · revoked" : ""} · <a href={`/dashboard/nda/${x.id}`}>copy</a>
                    {!x.revokedAt && <form action={revokeNda} style={{ display: "inline" }}><input type="hidden" name="id" value={x.id} /> <button className="btn sm ghost" type="submit">Revoke</button></form>}</li>))
                  : <li className="empty-li">None yet.</li>}</ul>
              </div>
            </div>
          </details>
        );
      })}
      {!os.length && <p>No family offices have registered yet.</p>}
    </>
  );
}
