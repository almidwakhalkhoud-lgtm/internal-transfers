import { currentUser } from "@/lib/auth";
import { hasMenu, landingPage } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { RequestDetail } from "@/components/request-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasMenu(user, "requests")) redirect(landingPage(user));
  return <RequestDetail id={(await params).id} />;
}
