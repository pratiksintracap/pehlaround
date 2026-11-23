import { requireAdmin } from "@/lib/credit/server/session";
import { Shell } from "@/components/credit/app/Shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <Shell
      subtitle="Platform team"
      who={admin.name}
      links={[
        { href: "/credit/admin", label: "Pipeline" },
        { href: "/credit/admin/raises", label: "Raises" },
        { href: "/credit/admin/borrowers", label: "Borrowers" },
        { href: "/credit/admin/deals", label: "Deals" },
        { href: "/credit/admin/lenders", label: "Lenders" },
        { href: "/credit/admin/prospects", label: "Prospects" },
        { href: "/credit/admin/submissions", label: "Submissions" },
        { href: "/credit/admin/partners", label: "Partners" },
        { href: "/credit/admin/activity", label: "Activity log" },
        { href: "/credit/admin/access-requests", label: "Access requests" },
        { href: "/credit/admin/settings", label: "Settings" },
      ]}
    >
      {children}
    </Shell>
  );
}
