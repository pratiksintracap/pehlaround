import { PendingButton } from "@/components/credit/app/PendingButton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { BRAND_NAME } from "@/lib/credit/brand";
import { beginTotpEnrolment, getPreSession } from "@/lib/credit/server/auth";
import { PRE_SESSION_COOKIE } from "@/lib/credit/server/session";
import { verifyTotpAction } from "../actions";

export default async function AuthenticatorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const token = (await cookies()).get(PRE_SESSION_COOKIE)?.value;
  const pre = token ? await getPreSession(token) : null;
  if (!pre) redirect("/credit/login");

  const enrolling = pre.session.stage === "totp_enroll";
  let qr: string | null = null;
  let secret: string | null = null;
  if (enrolling) {
    const e = await beginTotpEnrolment(token!);
    if (!e) redirect("/credit/login");
    secret = e.secret;
    const uri = `otpauth://totp/${encodeURIComponent(BRAND_NAME)}:${encodeURIComponent(e.email)}?secret=${e.secret}&issuer=${encodeURIComponent(BRAND_NAME)}`;
    qr = await QRCode.toDataURL(uri, { margin: 0, width: 180 });
  }

  return (
    <div className="auth">
      <div className="card">
        {enrolling ? (
          <>
            <h1>Set up your authenticator</h1>
            <p className="muted small">
              Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password or similar), then enter
              the 6-digit code it shows. You&apos;ll use it every time you sign in.
            </p>
            {qr && <img className="qr" src={qr} alt="Authenticator setup QR code" />}
            <details className="small" style={{ marginBottom: "1rem" }}>
              <summary>Can&apos;t scan? Enter this key instead</summary>
              <code className="secret">{secret}</code>
            </details>
          </>
        ) : (
          <>
            <h1>Enter your authenticator code</h1>
            <p className="muted small">Open your authenticator app and enter the current 6-digit code for {BRAND_NAME}.</p>
          </>
        )}
        <form action={verifyTotpAction} className="stack">
          <label>
            Authenticator code
            <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" autoFocus />
          </label>
          {error && <div className="msg error" role="alert">{error === "unavailable" ? "We couldn't complete sign-in just now. Please try again in a few minutes." : "That code didn't match. Codes change every 30 seconds; try the current one."}</div>}
          <PendingButton pendingText="Checking…">{enrolling ? "Finish setup" : "Sign in"}</PendingButton>
        </form>
      </div>
    </div>
  );
}
