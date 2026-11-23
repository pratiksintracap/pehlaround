import { PublicShell } from "@/components/credit/app/public/PublicShell";

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
