import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser, maskPan } from "@/lib/auth";
import { getDeal, signedDealIds, roomAccess } from "@/lib/deals";
import { NdaText } from "@/components/NdaText";

export const metadata: Metadata = { title: "NDA", robots: { index: false } };
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> };

export default async function Nda({ params, searchParams }: P) {
  const { slug } = await params;
  const { error } = await searchParams;
  const user = await getUser();
  if (!user) redirect(`/register?next=${encodeURIComponent(`/nda/${slug}`)}`);
  const d = await getDeal(slug);
  if (!d || !d.published) notFound();
  if (user.role === "admin" || (await signedDealIds(user.officeId)).has(d.id)) redirect(`/room/${slug}`);
  if (!d.open) redirect(`/deals/${slug}`);
  const acc = await roomAccess(user, d);
  if (acc.state === "pending-approval" || acc.state === "blocked") redirect(`/room/${slug}`);
  const office = user.office;
  return (
    <main><div className="wrap split" style={{ padding: "clamp(40px,6vw,72px) var(--gutter)" }}>
      <div className="rv inview">
        <ol className="stepper" aria-label="Step 2 of 3">
          <li className="done"><span className="dot">✓</span><span className="t">Register the office</span><span className="s">done</span></li>
          <li className="now"><span className="dot">2</span><span className="t">PAN and this deal&apos;s NDA</span><span className="s">sign on screen</span></li>
          <li><span className="dot">3</span><span className="t">This company&apos;s room</span><span className="s">at once</span></li>
        </ol>
        <span className="eyebrow">Non-disclosure agreement · {d.company}</span>
        <h1>An NDA with this company, for this deal</h1>
        <p className="lede">Every deal on the desk has its own NDA, signed directly between your family office and that company. This one opens the {d.company} room and nothing else; another deal needs its own NDA with its own company.</p>
        <NdaText company={d.company} office={office?.name || "the family office named at registration"} version={d.ndaVersion} />
      </div>
      <div className="rv inview" style={{ ["--d" as string]: ".1s" }}>
        <form className="form" id="nda" method="post" action="/api/nda" data-api="">
          <input type="hidden" name="slug" value={d.slug} />
          {error && <div className="ok show bad" role="alert">{error}</div>}
          {office?.pan ? (
            <p className="notice"><b>PAN on record:</b> {maskPan(office.pan)} · {office.entityName || office.name}{office.status === "verified" ? " · verified" : ""}</p>
          ) : (
            <>
              <label>Investing entity, as on PAN<input required name="entity" defaultValue={office?.entityName || ""} placeholder="e.g. Mehta Family Trust" /></label>
              <label>PAN of the investing entity<input required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" style={{ textTransform: "uppercase" }} name="pan" />
                <span className="hint">Checked by the desk against the name on PAN. Never shown to the company or other offices.</span></label>
            </>
          )}
          <label>Your full name, as signatory<input required autoComplete="name" name="sig" defaultValue={user.name} /></label>
          <label className="chk"><input type="checkbox" required name="agree" />I have read this agreement and sign it on behalf of {office?.name || "the family office named at registration"}.</label>
          <div><button className="btn primary" type="submit">Sign this NDA and open the room</button></div>
          <p className="fine">Signing records your name, the time, your IP address, the deal and the agreement version; a copy is kept in your office&apos;s documents and shared with the company.</p>
        </form>
      </div>
    </div></main>
  );
}
