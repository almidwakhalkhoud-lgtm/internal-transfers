"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageTitle, useBuzz } from "./shell";
import { AdminSettingsPage } from "./admin-pages";
import { NotificationsPage } from "./notifications";

export function SettingsPage() {
  const { user, t } = useBuzz();
  const query = useSearchParams();
  const notifications =
    user.role !== "ADMIN" || query.get("tab") === "notifications";
  return (
    <>
      <PageTitle title="Settings" />
      {user.role === "ADMIN" && (
        <nav
          className="notification-toolbar settings-tabs"
          aria-label={t("Settings")}
        >
          <Link
            className={`button ${!notifications ? "primary" : ""}`}
            href="/settings"
            aria-current={!notifications ? "page" : undefined}
          >
            {t("General settings")}
          </Link>
          <Link
            className={`button ${notifications ? "primary" : ""}`}
            href="/settings?tab=notifications"
            aria-current={notifications ? "page" : undefined}
          >
            {t("Notifications")}
          </Link>
        </nav>
      )}
      {notifications ? <NotificationsPage /> : <AdminSettingsPage />}
    </>
  );
}
