import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <Shell
      user={{
        menus: user.menus,
        id: user.id,
        name: user.name,
        role: user.role,
        locale: user.locale,
      }}
    >
      {children}
    </Shell>
  );
}
