import type { RoomContent } from "@/lib/types";

const LI = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-3.95z" /></svg>
);

/** The company's founders and management, each with an optional LinkedIn link (opens in a new tab). */
export function Founders({ list }: { list?: RoomContent["founders"] }) {
  if (!list?.length) return null;
  return (
    <ul className="founders" aria-label="Founders and management">
      {list.map((f, i) => (
        <li key={i}>
          <span className="fd-av" aria-hidden="true">{f.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
          <div><b>{f.name}</b>{f.role && <small>{f.role}</small>}</div>
          {f.url && <a className="fd-li" href={f.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${f.name} on LinkedIn`}><LI /> LinkedIn</a>}
        </li>
      ))}
    </ul>
  );
}
