import { requireLender } from "@/lib/credit/server/session";
import { getMyProfile } from "@/lib/credit/server/lender/deals";
import { Shell } from "@/components/credit/app/Shell";

export default async function LenderLayout({ children }: { children: React.ReactNode }) {
  const lender = await requireLender();
  const profile = await getMyProfile(lender);
  return (
    <Shell
      subtitle={profile.lender.name}
      who={`${lender.name} · ${lender.role === "lender_admin" ? "Admin" : "Viewer"}`}
      links={[
        { href: "/credit/lender", label: "Deal flow" },
        { href: "/credit/lender/profile", label: "Our profile" },
      ]}
    >
      {children}
    </Shell>
  );
}
