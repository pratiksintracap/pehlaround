"use client";
import { usePathname } from "next/navigation";

const GROUPS: [string, [string, string, string][]][] = [
  ["Desk", [
    ["/admin", "Overview", "M3 12l9-8 9 8M5 10v10h14V10"],
    ["/admin/offices", "Family offices", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"],
    ["/admin/invites", "Invite offices", "M4 4h16v16H4zM4 6l8 7 8-7"],
    ["/admin/activity", "Requests and Q&A", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
    ["/admin/analyst", "AI analyst", "M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8zM18.5 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"],
  ]],
  ["Content", [
    ["/admin/deals", "Deals", "M3 7h18M3 12h18M3 17h12"],
    ["/admin/articles", "Articles", "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"],
  ]],
  ["Reach", [
    ["/admin/notify", "Notify offices", "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"],
    ["/admin/emails", "Onboarding emails", "M22 6l-10 7L2 6M2 6h20v12H2z"],
  ]],
  ["System", [
    ["/admin/settings", "Settings", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
    ["/admin/log", "Audit log", "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  ]],
];

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname() || "/admin";
  const on = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  return (
    <nav className="side-nav adm-side-nav" aria-label="Desk admin">
      {GROUPS.map(([g, items]) => (
        <div key={g} className="sn-group"><span className="sn-h">{g}</span>
          {items.map(([h, t, ic]) => (
            <a key={h} href={h} className="tabbtn-like" aria-current={on(h) ? "page" : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ic} /></svg><span>{t}</span>{counts[h] ? <em>{counts[h]}</em> : null}</a>))}
        </div>))}
    </nav>
  );
}
