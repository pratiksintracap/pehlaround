import { PublicShell } from "@/components/credit/app/public/PublicShell";

/** Public pages for the borrower form: no sign-in needed. */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
