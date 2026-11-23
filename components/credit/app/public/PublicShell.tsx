import Link from "next/link";
import { currentActor } from "@/lib/credit/server/session";
import { signOutAction } from "@/app/credit/login/actions";

/** Chrome for the pages a borrower or their agent sees: the website's look, no admin furniture. */
export async function PublicShell({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  const applicant = actor?.kind === "applicant_user";
  return (
    <div className="public">
      <nav className="public-nav public-sub" aria-label="Borrower form">
        <Link href="/private-credit/how-it-works">How it works</Link>
        <Link href="/private-credit/confidentiality">Confidentiality</Link>
        {applicant ? (
          <>
            <Link href="/credit/my">Your forms</Link>
            <form action={signOutAction}><button type="submit" className="linkish">Sign out</button></form>
          </>
        ) : actor ? (
          <Link href="/credit">Dashboard</Link>
        ) : (
          <Link href="/credit/login">Sign in</Link>
        )}
      </nav>
      <main className="public-main" id="main">{children}</main>
    </div>
  );
}
