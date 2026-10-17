import { randomUUID } from "node:crypto";
import { TransferForm } from "@/components/transfer-form";
import { currentUser } from "@/lib/auth";
import { hasMenu, landingPage } from "@/lib/permissions";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasMenu(user, "new-transfer")) redirect(landingPage(user));
  return (
    <TransferForm initialKey={randomUUID()} initialLineId={randomUUID()} />
  );
}
