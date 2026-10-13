import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, ndas, offices, users } from "@/db/schema";
import { ndaPdf, type NdaRecord } from "@/lib/nda-pdf";
import { E, layout, sendRaw } from "@/lib/email";

export async function ndaRecord(id: number): Promise<(NdaRecord & { officeId: number; slug: string }) | null> {
  const db = await getDb();
  const [n] = await db.select().from(ndas).where(eq(ndas.id, id));
  if (!n) return null;
  const [[d], [o], [u]] = await Promise.all([
    db.select().from(deals).where(eq(deals.id, n.dealId)), db.select().from(offices).where(eq(offices.id, n.officeId)), db.select().from(users).where(eq(users.id, n.userId)),
  ]);
  return { id: n.id, company: d.company, slug: d.slug, officeId: o.id, officeName: o.name, entityName: o.entityName, signerName: n.signerName,
    signerEmail: n.signerEmail || u?.email || "", codeVerified: n.codeVerified, version: n.version, signedAt: n.signedAt, ip: n.ip };
}

export const ndaFilename = (r: { company: string; officeName: string }) =>
  `NDA - ${r.company} - ${r.officeName}.pdf`.replace(/[^\w .&()-]+/g, "").replace(/\s+/g, " ");

/** Emails the signer their signed NDA as a PDF, the moment they sign. */
export async function emailSignedNda(id: number) {
  const r = await ndaRecord(id);
  if (!r || !r.signerEmail) return 0;
  const pdf = await ndaPdf(r);
  const body = E.h(`Your signed NDA with ${r.company}`)
    + E.p(`Dear ${r.signerName.split(" ")[0]},`)
    + E.p(`Thank you for signing the non-disclosure agreement with <b>${r.company}</b> on behalf of ${r.officeName}. The signed copy is attached as a PDF for your records.`)
    + E.p(`The company's deal room is now open to your office: the numbers, the terms, the path to listing, the risks the desk sees, the documents and the promoter's answers.`)
    + E.btn("Open the deal room", `/room/${r.slug}`)
    + E.p(`The agreement covers ${r.company} only. Every signed NDA also stays in your dashboard under Documents.`);
  return sendRaw([r.signerEmail], `Signed NDA: ${r.company}`, layout(body, { preheader: `Your signed NDA with ${r.company} is attached.` }), [{ filename: ndaFilename(r), content: pdf }]);
}
