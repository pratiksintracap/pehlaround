import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { dbKind } from "@/lib/db";

export const metadata: Metadata = { title: "Desk admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const kind = dbKind();
  return (
    <main className="adm"><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <div className="adm-top">
        <div><span className="eyebrow">Desk admin · {me.name}</span></div>
        <nav className="adm-nav">
          <a href="/admin">Overview</a><a href="/admin/offices">Offices</a><a href="/admin/deals">Deals</a><a href="/admin/activity">Requests and Q&amp;A</a><a href="/admin/log">Log</a>
        </nav>
      </div>
      {kind !== "postgres" && (
        <p className="notice" style={{ borderColor: "#c0392b", marginBottom: 16 }}><b>No database connected.</b> The site is running on a temporary built-in database: registrations and edits are lost when the server restarts. In Vercel, open the project → Storage → create a Neon Postgres database and connect it to this project (it sets DATABASE_URL), then redeploy.</p>
      )}
      {children}
    </div></main>
  );
}
