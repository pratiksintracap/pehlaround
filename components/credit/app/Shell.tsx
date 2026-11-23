import Link from "next/link";
import { BRAND_NAME } from "@/lib/credit/brand";
import { signOutAction } from "@/app/credit/login/actions";

export function Shell({
  subtitle,
  links,
  who,
  children,
}: {
  subtitle: string;
  links: { href: string; label: string }[];
  who: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="brand">
          {BRAND_NAME}
          <span>{subtitle}</span>
        </div>
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
        <div className="spacer" />
        <div className="who">
          {who}
          <form action={signOutAction}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
