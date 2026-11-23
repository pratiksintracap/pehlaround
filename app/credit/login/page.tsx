import { PendingButton } from "@/components/credit/app/PendingButton";
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/credit/brand";
import { currentActor } from "@/lib/credit/server/session";
import { requestCodeAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const actor = await currentActor().catch(() => null);
  if (actor) redirect("/");
  return (
    <div className="auth">
      <div className="card">
        <h1>Sign in to {BRAND_NAME}</h1>
        <p className="muted small">Access is by invitation. We&apos;ll email you a sign-in code.</p>
        <form action={requestCodeAction} className="stack">
          <label>
            Work email
            <input name="email" type="email" required autoComplete="email" autoFocus />
          </label>
          {error === "unavailable" && (
            <div className="msg error" role="alert">We couldn&apos;t complete sign-in just now. Please try again in a few minutes.</div>
          )}
          <PendingButton pendingText="Sending code…">Email me a code</PendingButton>
        </form>
      </div>
    </div>
  );
}
