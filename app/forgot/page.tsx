import type { Metadata } from "next";
import { DESK_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default async function Forgot({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <main className="wrap authpage">
      <span className="eyebrow">Your office&apos;s desk</span>
      <h1>Reset your password</h1>
      {sent ? (
        <p className="lede">If that email is registered, a reset link is on its way. It works once, for one hour. Nothing arrived? Write to <a href={`mailto:${DESK_EMAIL}`}>{DESK_EMAIL}</a> from your registered email.</p>
      ) : (
        <form className="form" method="post" action="/api/auth/forgot">
          {error && <div className="ok show bad" role="alert">{error}</div>}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
          <label>Registered email<input type="email" name="email" required autoComplete="email" /></label>
          <div><button className="btn primary" type="submit">Send the reset link</button></div>
          <p className="fine"><a href="/login">Back to sign in</a></p>
        </form>
      )}
    </main>
  );
}
