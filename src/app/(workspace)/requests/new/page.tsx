import { randomUUID } from "node:crypto";
import { RequestForm } from "@/components/request-pages";
import { currentUser } from "@/lib/auth";
import { hasMenu, landingPage } from "@/lib/permissions";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasMenu(user, "requests")) redirect(landingPage(user));
  return <RequestForm initialLineId={randomUUID()} />;
}
