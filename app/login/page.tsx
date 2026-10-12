import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { DESK_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in" };
type P = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function Login({ searchParams }: P) {
  const { next = "", error } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/dashboard");
  return (
    <main><div className="wrap split" style={{ padding: "clamp(40px,6vw,72px) var(--gutter)" }}>
      <div className="rv inview">
        <span className="eyebrow">Family offices</span>
        <h1>Sign in</h1>
        <p className="lede">Your office&apos;s shelf, rooms, calls, documents and log, in one place.</p>
        <p className="fine">New to the desk? <a href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Register your office</a>. Forgotten your password? Write to <a href={`mailto:${DESK_EMAIL}`}>{DESK_EMAIL}</a> from your registered email.</p>
      </div>
      <div className="rv inview" style={{ ["--d" as string]: ".1s" }}>
        <form className="form" method="post" action="/api/auth/login" data-api="">
          <input type="hidden" name="next" value={next} />
          {error && <div className="ok show bad" role="alert">{error}</div>}
          <label>Email<input type="email" required autoComplete="email" name="email" /></label>
          <label>Password<input type="password" required autoComplete="current-password" name="password" /></label>
          <div><button className="btn primary" type="submit">Sign in</button></div>
        </form>
      </div>
    </div></main>
  );
}
