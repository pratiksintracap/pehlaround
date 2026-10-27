import type { Metadata } from "next";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { isSuper, ROLE_LABEL, type DeskRole } from "@/lib/perm";
import { dbKind, getDb } from "@/lib/db";
import { offices, questions, interests, tickets } from "@/db/schema";
import { AdminNav } from "@/components/AdminNav";
import { openTaskCount } from "@/lib/desk";
import { Suspense } from "react";
import { FormResult } from "@/components/Form";

export const metadata: Metadata = { title: "Desk admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireDesk();
  const kind = dbKind();
  const db = await getDb();
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [pending, qs, reqs, tks, myTasks] = await Promise.all([
    n(db.select({ n: sql<number>`count(*)::int` }).from(offices).where(eq(offices.approval, "pending"))),
    n(db.select({ n: sql<number>`count(*)::int` }).from(questions).where(and(isNull(questions.answer), eq(questions.hidden, false)))),
    n(db.select({ n: sql<number>`count(*)::int` }).from(interests).where(eq(interests.status, "Indicated"))),
    n(db.select({ n: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.status, "open"))),
    openTaskCount(me.id),
  ]);
  return (
    <main className="adm"><div className="wrap app-wrap"><div className="app">
      <aside className="app-side" aria-label="Desk admin">
        <div className="as-office">
          <span className="as-av desk" aria-hidden="true">D</span>
          <div><b>Desk admin</b><small>{me.name} · {ROLE_LABEL[me.role as DeskRole]}</small></div>
        </div>
        <AdminNav full={isSuper(me)} counts={{ "/admin/offices": pending, "/admin/activity": qs + reqs, "/admin/tickets": tks, "/admin/tasks": myTasks }} />
        <div className="as-foot"><a href="/deals">View the site</a><a href="/dashboard">Office view</a></div>
      </aside>
      <div className="app-main">
        <a className="adm-appback" href="/desk">‹ Back to the desk</a>
        {kind !== "postgres" && (
          <p className="notice" style={{ borderColor: "#c0392b", marginBottom: 16 }}><b>No database connected.</b> The site is running on a temporary built-in database: registrations and edits are lost when the server restarts. In Vercel, open the project → Storage → create a Neon Postgres database and connect it to this project (it sets DATABASE_URL), then redeploy.</p>
        )}
        <Suspense fallback={null}><FormResult /></Suspense>
        {children}
      </div>
    </div></div></main>
  );
}
