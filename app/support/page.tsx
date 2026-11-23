import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

// Support has no page of its own: tickets live in the Support section of the dashboard. This address (linked in the
// menu and the footer) sends each person to the right place.
export default async function Support() {
  const user = await getUser();
  if (!user) redirect("/login?next=/support");
  if (user.role === "promoter") redirect("/founder");
  redirect("/dashboard#Support");
}
