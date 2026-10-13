import type { Deal, Access } from "@/lib/deals";
import { DESK_EMAIL } from "@/lib/site";

export function GateCard({ deal, state }: { deal: Deal; state: Exclude<Access["state"], "open"> }) {
  const next = encodeURIComponent(`/nda/${deal.slug}`);
  let body: React.ReactNode;
  switch (state) {
    case "anon":
      body = <>
        <p>The company&apos;s name, numbers, documents and promoter Q&amp;A open after registration and an NDA signed directly with this company, both on screen. No call with us is needed.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn primary" href={`/register?next=${next}`}>Register</a>
          <a className="btn" href={`/login?next=${next}`}>Already registered: sign in</a>
        </div>
        <p className="fine">The room opens the moment that company&apos;s NDA is signed.</p>
      </>;
      break;
    case "need-nda":
      body = <>
        <p>Your office is registered. This room opens with an NDA between your office and this company, signed on screen. It covers this company only.</p>
        <div><a className="btn primary" href={`/nda/${deal.slug}`}>Sign this company&apos;s NDA</a></div>
      </>;
      break;
    case "pending-approval":
      body = <p>Thank you for registering. The desk is reviewing your office, usually within a working day. Once approved you will see every company by name and can sign this company&apos;s NDA; we will let you know in your dashboard and by email.</p>;
      break;
    case "pending-pan":
      body = <p>Your office has signed this company&apos;s NDA. The desk is completing its checks; the room opens as soon as that is done, usually within a working day.</p>;
      break;
    case "closed":
      body = <>
        <p>This room is not open yet. The overview shows what the desk has checked so far.</p>
        <div><a className="btn" href={`/deals/${deal.slug}`}>Read the overview</a></div>
      </>;
      break;
    case "blocked":
      body = <p>Your office&apos;s access is on hold. Please write to <a href={`mailto:${DESK_EMAIL}`}>{DESK_EMAIL}</a>.</p>;
      break;
    default:
      body = <p>Rooms open to family offices. Please register your office to continue. <a href="/register">Register</a></p>;
  }
  return (
    <div className="gatewall" style={{ position: "static", minHeight: 360 }}>
      <div className="gatecard" style={{ margin: "40px auto" }}>
        <span className="eyebrow lock">Deal room</span>
        <h2>{deal.title}</h2>
        {body}
      </div>
    </div>
  );
}
