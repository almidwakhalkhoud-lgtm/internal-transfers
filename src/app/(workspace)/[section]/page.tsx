import { notFound, redirect } from "next/navigation";
import { hasMenu, landingPage } from "@/lib/permissions";
import { currentUser } from "@/lib/auth";
import { Dashboard, HistoryPage, ProductsPage } from "@/components/data-pages";
import { RequestsPage } from "@/components/request-pages";
import { SettingsPage } from "@/components/settings-page";
import { LocationsPage, UsersPage, AuditPage } from "@/components/admin-pages";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ notification?: string }>;
}) {
  const { section } = await params;
  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  if (
    !["access", "notifications", "settings"].includes(section) &&
    !hasMenu(viewer, section)
  )
    redirect(landingPage(viewer));
  if (["users", "audit"].includes(section)) {
    const user = await currentUser();
    if (user?.role !== "ADMIN") redirect("/dashboard");
  }
  switch (section) {
    case "notifications": {
      const { notification } = await searchParams;
      return redirect(
        `/settings?tab=notifications${notification ? `&notification=${encodeURIComponent(notification)}` : ""}`,
      );
    }
    case "access":
      return (
        <p>
          {viewer.locale === "fa"
            ? "برای دریافت دسترسی با مدیر تماس بگیرید."
            : "Contact your administrator for menu access."}
        </p>
      );
    case "dashboard":
      return <Dashboard />;
    case "transfers":
      return <HistoryPage />;
    case "requests":
      return <RequestsPage />;
    case "products":
      return <ProductsPage />;
    case "locations":
      return <LocationsPage />;
    case "users":
      return <UsersPage />;
    case "settings":
      return <SettingsPage />;
    case "audit":
      return <AuditPage />;
    default:
      notFound();
  }
}
