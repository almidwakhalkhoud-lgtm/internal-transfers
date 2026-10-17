import { currentUser } from "@/lib/auth";
import { hasMenu, landingPage } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DetailPage } from "@/components/data-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasMenu(user, "transfers")) redirect(landingPage(user));
  return <DetailPage id={(await params).id} />;
}
