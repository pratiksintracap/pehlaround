import { PendingButton } from "@/components/credit/app/PendingButton";
import Link from "next/link";
import { verifyCodeAction } from "../actions";

export default async function CodePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="auth">
      <div className="card">
        <h1>Enter your sign-in code</h1>
        <p className="muted small">If your email has access, a 6-digit code is on its way. It expires in 10 minutes.</p>
        <form action={verifyCodeAction} className="stack">
          <label>
            Sign-in code
            <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" autoFocus />
          </label>
          {error && <div className="msg error" role="alert">{error === "unavailable" ? "We couldn't complete sign-in just now. Please try again in a few minutes." : "That code didn't work. Check it, or request a new one."}</div>}
          <PendingButton pendingText="Signing in…">Continue</PendingButton>
        </form>
        <p className="small" style={{ marginTop: "1rem" }}>
          <Link href="/credit/login">Use a different email or request a new code</Link>
        </p>
      </div>
    </div>
  );
}
