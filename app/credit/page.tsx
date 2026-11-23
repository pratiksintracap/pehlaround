import { redirect } from "next/navigation";
import { currentActor } from "@/lib/credit/server/session";

export default async function Home() {
  const a = await currentActor();
  if (!a) redirect("/credit/login");
  redirect(a.kind === "admin" ? "/credit/admin" : a.kind === "partner" ? "/credit/partner" : a.kind === "applicant_user" ? "/credit/my" : "/credit/lender");
}
