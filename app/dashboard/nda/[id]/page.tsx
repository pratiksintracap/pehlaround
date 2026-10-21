import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deals, ndas, offices } from "@/db/schema";
import { NdaText } from "@/components/NdaText";
import { isDesk } from "@/lib/perm";
import { investorWhere } from "@/lib/deal-guard";

export const metadata: Metadata = { title: "Signed NDA", robots: { index: false } };

export default async function SignedNda({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("/dashboard");
  const db = await getDb();
  const [n] = await db.select().from(ndas).where(eq(ndas.id, Number((await params).id)));
  if (!n || (n.officeId !== user.officeId && !isDesk(user))) notFound();
  const [d] = await db.select().from(deals).where(investorWhere(eq(deals.id, n.dealId)));
  if (!d) notFound();
  const [o] = await db.select().from(offices).where(eq(offices.id, n.officeId));
  const at = n.signedAt.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" });
  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56, maxWidth: 820 }}>
      <p className="crumb"><a href="/dashboard#Documents">← Back to your documents</a></p>
      <span className="eyebrow">Signed non-disclosure agreement</span>
      <h1>{d.company} · {o.name}</h1>
      <NdaText company={d.company} office={o.entityName ? `${o.name} (${o.entityName})` : o.name} version={n.version} />
      <dl className="terms compact" style={{ marginTop: 18 }}>
        <div><dt>Signed by</dt><dd>{n.signerName}, for {o.name}</dd></div>
        <div><dt>Signed at</dt><dd>{at} IST</dd></div>
        <div><dt>Recorded from</dt><dd>{n.ip || "—"}</dd></div>
        <div><dt>Agreement version</dt><dd>{n.version}</dd></div>
      </dl>
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn primary" href={`/dashboard/nda/${n.id}/pdf`} target="_blank" rel="noopener">Download the signed PDF</a><button type="button" className="btn" data-print="">Print</button></div>
      <p className="fine">A copy of this PDF was emailed to the signatory when the agreement was signed.</p>
    </div></main>
  );
}
