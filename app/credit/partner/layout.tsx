import { requirePartner } from "@/lib/credit/server/session";
import { getMyPartner } from "@/lib/credit/server/intake/partner";
import { Shell } from "@/components/credit/app/Shell";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const partner = await requirePartner();
  const firm = await getMyPartner(partner);
  return (
    <Shell subtitle={firm?.name ?? "Partner"} who={partner.name} links={[{ href: "/credit/partner", label: "Companies" }]}>
      {children}
    </Shell>
  );
}
