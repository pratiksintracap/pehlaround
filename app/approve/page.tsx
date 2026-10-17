import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { offices, users } from "@/db/schema";
import { applyApproval, readApprovalToken, type Approval } from "@/lib/approval";
import { PUBLIC_TAG } from "@/lib/cache";
import { TYPE_LABEL } from "@/lib/investor";

export const metadata: Metadata = { title: "Approve an office", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Reached from the desk's "new office registered" email. Opening the link changes nothing; the button does,
// so mail scanners that follow links cannot approve anyone.
async function decide(f: FormData) {
  "use server";
  const t = String(f.get("t") ?? ""), a = String(f.get("a") ?? "") as Approval;
  const tok = readApprovalToken(t);
  if (!tok || !["approved", "rejected"].includes(a)) redirect(`/approve?t=${encodeURIComponent(t)}&done=bad`);
  await applyApproval(tok!.officeId, a, null, a === "rejected" && f.get("tell") === "on" ? "" : null, " (from the desk email)");
  revalidatePath("/admin/offices");
  revalidateTag(PUBLIC_TAG);
  redirect(`/approve?t=${encodeURIComponent(t)}&done=${a}`);
}

export default async function Approve({ searchParams }: { searchParams: Promise<{ t?: string; a?: string; done?: string }> }) {
  const { t = "", a = "approved", done } = await searchParams;
  const tok = readApprovalToken(t);
  if (!tok) return (
    <main className="wrap authpage"><h1>This link has expired</h1><p className="lede">Approval links in the desk email last seven days. <a href="/admin/offices?show=pending">Open the admin</a> to approve or hold.</p></main>
  );
  const db = await getDb();
  const [o] = await db.select().from(offices).where(eq(offices.id, tok.officeId));
  if (!o) return <main className="wrap authpage"><h1>Office not found</h1></main>;
  const team = await db.select({ name: users.name, email: users.email, phone: users.phone, role: users.officeRole }).from(users).where(eq(users.officeId, o.id));
  const hold = a === "rejected";
  const state = o.approval === "approved" ? "Approved" : o.approval === "rejected" ? "On hold" : "Waiting for approval";
  return (
    <main className="wrap authpage">
      <span className="eyebrow">Desk · new registration</span>
      <h1>{o.name}</h1>
      {done === "approved" && <div className="ok show" role="status">Approved. Every company is open to them now, and the welcome email is on its way.</div>}
      {done === "rejected" && <div className="ok show" role="status">On hold. They cannot see company names or rooms.</div>}
      {done === "bad" && <div className="ok show bad" role="alert">That did not go through. Please use the admin.</div>}
      <dl className="facts" style={{ margin: "14px 0 18px" }}>
        <div><dt>Status</dt><dd>{state}</dd></div>
        <div><dt>Type</dt><dd>{TYPE_LABEL[o.investorType as keyof typeof TYPE_LABEL] ?? o.investorType}</dd></div>
        <div><dt>Ticket</dt><dd>{o.ticket || "Not given"}</dd></div>
        <div><dt>Category</dt><dd>{o.category || "Not given"}</dd></div>
        {team.map((u, i) => <div key={i}><dt>{u.role || "Member"}</dt><dd>{u.name}<br /><a href={`mailto:${u.email}`}>{u.email}</a>{u.phone ? <><br /><a href={`tel:${u.phone}`}>{u.phone}</a></> : null}</dd></div>)}
      </dl>
      {!done && (
        <form className="form" action={decide}>
          <input type="hidden" name="t" value={t} />
          {hold && <label className="check"><input type="checkbox" name="tell" /> <span>Tell them their access is on hold</span></label>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className={`btn${hold ? "" : " primary"}`} name="a" value="approved" type="submit">Approve</button>
            <button className={`btn${hold ? " primary" : ""}`} name="a" value="rejected" type="submit">Hold</button>
          </div>
        </form>
      )}
      <p className="fine" style={{ marginTop: 18 }}><a href="/admin/offices?show=pending">Open the admin</a></p>
    </main>
  );
}
