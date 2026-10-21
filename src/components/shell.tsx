"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ClipboardList,
  LayoutDashboard,
  Package,
  MapPin,
  Users,
  Settings,
  History,
  LogOut,
  Plus,
  Globe,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { translate, type Locale } from "@/lib/i18n";
import { api } from "@/lib/client";
import { hasMenu } from "@/lib/permissions";
import { buttonStyles, cx, iconButton } from "./ui";
import {
  NotificationProvider,
  NotificationBell,
  NotificationBanner,
} from "./notifications";
export type Viewer = {
  menus: string[];
  id: string;
  name: string;
  role: string;
  locale: string;
};
const Context = createContext<{
  user: Viewer;
  locale: Locale;
  t: (key: string) => string;
  toast: (message: string, tone?: "error" | "ok") => void;
}>({
  user: { menus: [], id: "", name: "", role: "", locale: "en" },
  locale: "en",
  t: (k) => k,
  toast: () => {},
});
export const useBuzz = () => useContext(Context);
export function Shell({
  user,
  children,
}: {
  user: Viewer;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(
    user.locale === "fa" ? "fa" : "en",
  );
  const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        !sidebar.current?.contains(event.target as Node) &&
        !menuButton.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  const path = usePathname();
  const router = useRouter();
  const t = (key: string) => translate(locale, key);
  // Short messages that appear at the top and fade on their own, so a
  // validation hint never changes the size of the page under it.
  const [toasts, setToasts] = useState<
    { id: number; message: string; tone: "error" | "ok" }[]
  >([]);
  const toast = useCallback(
    (message: string, tone: "error" | "ok" = "error") => {
      const id = Date.now() + Math.random();
      setToasts((list) => [
        ...list.filter((x) => x.message !== message),
        { id, message, tone },
      ]);
      setTimeout(
        () => setToasts((list) => list.filter((x) => x.id !== id)),
        4000,
      );
    },
    [],
  );
  const nav = [
    ["Overview", "/dashboard", LayoutDashboard],
    ["New transfer", "/new-transfer", ArrowLeftRight],
    ["Requests", "/requests", ClipboardList],
    ["Transfer history", "/transfers", History],
    ["Products", "/products", Package],
    ["Locations", "/locations", MapPin],
    ["Settings", "/settings", Settings],
  ] as const;
  const admin = [
    ["Users", "/users", Users],
    ["Audit log", "/audit", ShieldCheck],
  ] as const;
  const navLink = (url: string) =>
    cx(
      "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors lg:text-[15px]",
      path === url
        ? "bg-brand-soft font-semibold text-brand before:absolute before:-start-4 before:h-4 before:w-[3px] before:rounded-e before:bg-brand"
        : "text-muted hover:bg-zinc-50 hover:text-ink",
    );
  const sectionLabel =
    "mb-2 px-3 text-[11px] font-medium tracking-widest text-subtle uppercase";
  return (
    <Context.Provider value={{ user, locale, t, toast }}>
      <NotificationProvider>
        <div
          className="min-h-dvh bg-page font-sans text-ink"
          dir={locale === "fa" ? "rtl" : "ltr"}
          lang={locale}
        >
          <div
            className="pointer-events-none fixed inset-x-4 top-16 z-[120] flex flex-col items-center gap-2 md:top-20"
            aria-live="assertive"
          >
            {toasts.map((x) => (
              <div
                key={x.id}
                role={x.tone === "error" ? "alert" : "status"}
                className={cx(
                  "pointer-events-auto w-full max-w-sm animate-[float-in_160ms_ease-out] rounded-xl border px-4 py-3 text-sm shadow-lg",
                  x.tone === "error"
                    ? "border-red-100 bg-red-50 text-red-800"
                    : "border-emerald-100 bg-emerald-50 text-emerald-800",
                )}
              >
                {x.message}
              </div>
            ))}
          </div>
          {open && (
            <button
              type="button"
              className="fixed inset-0 z-30 border-0 bg-zinc-900/30 lg:hidden"
              aria-label={t("Close menu")}
              onClick={() => setOpen(false)}
            />
          )}
          <aside
            id="workspace-navigation"
            ref={sidebar}
            className={cx(
              "fixed inset-y-0 start-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-e border-line bg-white px-4 pt-6 transition-[translate,visibility] duration-200 lg:w-60",
              // Closed, the drawer is also invisible so Tab cannot reach it.
              open
                ? "visible translate-x-0 shadow-xl"
                : "max-lg:invisible max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
            )}
          >
            <Link
              className="mb-8 flex flex-col items-start px-3"
              href="/dashboard"
              onClick={() => setOpen(false)}
            >
              <Image
                src="/logo.jpeg"
                width={116}
                height={68}
                alt="BUZZ"
                priority
                className="h-11 w-32 object-cover mix-blend-multiply"
              />
              <span className="mt-1.5 text-[10px] tracking-[0.2em] text-subtle">
                INTERNAL TRANSFERS
              </span>
            </Link>
            <div className={sectionLabel}>{t("Workspace")}</div>
            <nav className="flex flex-col gap-1">
              {nav
                .filter(
                  ([, url]) =>
                    url === "/settings" || hasMenu(user, url.slice(1)),
                )
                .map(([label, url, Icon]) => (
                  <Link
                    key={url}
                    onClick={() => setOpen(false)}
                    className={navLink(url)}
                    href={url}
                  >
                    <Icon size={18} />
                    {t(label)}
                    {label === "New transfer" && (
                      <Plus size={15} className="ms-auto text-subtle" />
                    )}
                  </Link>
                ))}
            </nav>
            {user.role === "ADMIN" && (
              <>
                <div className={cx(sectionLabel, "mt-7")}>
                  {t("Administration")}
                </div>
                <nav className="flex flex-col gap-1">
                  {admin.map(([label, url, Icon]) => (
                    <Link
                      key={url}
                      onClick={() => setOpen(false)}
                      className={navLink(url)}
                      href={url}
                    >
                      <Icon size={18} />
                      {t(label)}
                    </Link>
                  ))}
                </nav>
              </>
            )}
            <div className="mt-auto pt-6">
              <div className="mx-3 mb-4 flex items-center gap-2 text-xs leading-relaxed text-subtle">
                <ShieldCheck size={16} />
                {t("Access is checked on the server.")}
              </div>
              <div className="-mx-4 flex items-center gap-3 border-t border-line px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold">
                    {user.name}
                  </strong>
                  <small className="block text-xs text-subtle">
                    {t(user.role === "ADMIN" ? "Administrator" : "Staff")}
                  </small>
                </div>
                <button
                  className={cx(iconButton, "ms-auto")}
                  aria-label={t("Sign out")}
                  onClick={async () => {
                    let endpoint: string | undefined;
                    try {
                      const registration =
                        await navigator.serviceWorker?.getRegistration("/");
                      endpoint = (
                        await registration?.pushManager.getSubscription()
                      )?.endpoint;
                      for (const notification of (await registration?.getNotifications()) ??
                        [])
                        notification.close();
                    } catch {
                      /* Device APIs are optional for sign-out. */
                    }
                    await api("logout", { endpoint });
                    router.push("/login");
                    router.refresh();
                  }}
                >
                  <LogOut size={18} className="rtl:-scale-x-100" />
                </button>
              </div>
            </div>
          </aside>
          <div className="flex min-h-dvh min-w-0 flex-col lg:ps-60">
            <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/90 px-2 backdrop-blur md:h-16 md:px-8">
              <div className="flex min-w-0 items-center gap-2 text-sm text-subtle md:gap-3">
                <button
                  className={cx(iconButton, "lg:hidden")}
                  ref={menuButton}
                  aria-label="Menu"
                  aria-expanded={open}
                  aria-controls="workspace-navigation"
                  onClick={() => setOpen(!open)}
                >
                  <Menu size={22} />
                </button>
                <span className="hidden md:inline">{t("Workspace")}</span>
                <span className="hidden text-zinc-300 md:inline">/</span>
                <strong className="truncate font-semibold text-ink">
                  {t(
                    [...nav, ...admin].find(([, url]) =>
                      path.startsWith(url),
                    )?.[0] ?? "Transfer details",
                  )}
                </strong>
              </div>
              <div className="flex items-center gap-5 pe-2 md:pe-0">
                <NotificationBell />
                <span
                  dir="ltr"
                  className="hidden text-xs tracking-wide text-subtle md:inline"
                >
                  MEHDI ALI TRADING Co.
                </span>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-muted hover:bg-zinc-50"
                  onClick={async () => {
                    const value = locale === "en" ? "fa" : "en";
                    await api("me", { locale: value }, "PATCH");
                    setLocale(value);
                  }}
                >
                  <Globe size={16} />
                  {locale === "en" ? "فارسی" : "English"}
                </button>
              </div>
            </header>
            <NotificationBanner />
            <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-5 pb-8 md:px-8 md:pt-8">
              {children}
            </main>
            <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-4 text-xs text-subtle md:px-8">
              <span>
                <b className="font-semibold text-muted">BUZZ</b> /{" "}
                {t("Internal transfers")}
              </span>
              <span dir="ltr">MEHDI ALI TRADING Co.</span>
            </footer>
          </div>
        </div>
      </NotificationProvider>
    </Context.Provider>
  );
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { t } = useBuzz();
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 md:mb-7">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-brand uppercase">
            {t(eyebrow)}
          </div>
        )}
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {t(title)}
        </h1>
        {subtitle && (
          <p className="mt-1.5 mb-0 text-sm leading-relaxed text-muted">
            {t(subtitle)}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
export function NewTransferLink() {
  const { t, user } = useBuzz();
  if (!hasMenu(user, "new-transfer")) return null;
  return (
    <Link className={buttonStyles.primary} href="/new-transfer">
      <Plus size={17} />
      {t("New transfer")}
    </Link>
  );
}
const statusTone: Record<string, string> = {
  PENDING: "border-amber-100 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-100 bg-emerald-50 text-emerald-700",
  RECEIVED: "border-emerald-100 bg-emerald-50 text-emerald-700",
  CONFIRMED: "border-emerald-100 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-100 bg-red-50 text-red-700",
  OPEN: "border-amber-100 bg-amber-50 text-amber-800",
  FULFILLED: "border-emerald-100 bg-emerald-50 text-emerald-700",
  DECLINED: "border-red-100 bg-red-50 text-red-700",
};
export function Status({ value }: { value: string }) {
  const { t } = useBuzz();
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs whitespace-nowrap",
        statusTone[value] ?? "border-line bg-zinc-50 text-muted",
      )}
    >
      <span className="size-1 rounded-full bg-current" />
      {t(value[0] + value.slice(1).toLowerCase())}
    </span>
  );
}
