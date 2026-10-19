import { currentUser } from "@/lib/auth";
import { hasMenu, landingPage } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SignTransferPage } from "@/components/sign-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasMenu(user, "sign")) redirect(landingPage(user));
  return <SignTransferPage id={(await params).id} />;
}
