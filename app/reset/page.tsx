import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  return (
    <main className="wrap authpage">
      <span className="eyebrow">Your office&apos;s desk</span>
      <h1>Choose a new password</h1>
      {!token ? <p className="lede">This link is incomplete. <a href="/forgot">Ask for a new one.</a></p> : (
        <form className="form" method="post" action="/api/auth/reset">
          {error && <div className="ok show bad" role="alert">{error}</div>}
          <input type="hidden" name="token" value={token} />
          <label>New password<input type="password" name="password" minLength={8} required autoComplete="new-password" /><span className="hint">At least 8 characters. Signing in with it ends every other sign-in.</span></label>
          <label>Once more<input type="password" name="password2" minLength={8} required autoComplete="new-password" /></label>
          <div><button className="btn primary" type="submit">Save and sign in</button></div>
        </form>
      )}
    </main>
  );
}
