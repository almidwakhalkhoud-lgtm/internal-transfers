"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
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
  PanelLeftClose,
  Menu,
} from "lucide-react";
import { translate, type Locale } from "@/lib/i18n";
import { api } from "@/lib/client";
import { hasMenu } from "@/lib/permissions";
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
}>({
  user: { menus: [], id: "", name: "", role: "", locale: "en" },
  locale: "en",
  t: (k) => k,
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
  const nav = [
    ["Overview", "/dashboard", LayoutDashboard],
    ["New transfer", "/new-transfer", ArrowLeftRight],
    ["Transfer history", "/transfers", History],
    ["Products", "/products", Package],
    ["Locations", "/locations", MapPin],
  ] as const;
  const admin = [
    ["Users", "/users", Users],
    ["Settings", "/settings", Settings],
    ["Audit log", "/audit", ShieldCheck],
  ] as const;
  return (
    <Context.Provider value={{ user, locale, t }}>
      <div className="app" dir={locale === "fa" ? "rtl" : "ltr"} lang={locale}>
        {open && (
          <button
            type="button"
            className="sidebar-scrim"
            aria-label={t("Close menu")}
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          id="workspace-navigation"
          ref={sidebar}
          className={open ? "sidebar open" : "sidebar"}
        >
          <Link className="brand" href="/dashboard">
            <Image
              src="/logo.jpeg"
              width={116}
              height={68}
              alt="BUZZ"
              priority
            />
            <span>INTERNAL TRANSFERS</span>
          </Link>
          <div className="nav-label">{t("Workspace")}</div>
          <nav>
            {nav
              .filter(([, url]) => hasMenu(user, url.slice(1)))
              .map(([label, url, Icon]) => (
                <Link
                  key={url}
                  onClick={() => setOpen(false)}
                  className={path === url ? "nav-item selected" : "nav-item"}
                  href={url}
                >
                  <Icon size={18} />
                  {t(label)}
                  {label === "New transfer" && <kbd>＋</kbd>}
                </Link>
              ))}
          </nav>
          {user.role === "ADMIN" && (
            <>
              <div className="nav-label admin-label">{t("Administration")}</div>
              <nav>
                {admin.map(([label, url, Icon]) => (
                  <Link
                    key={url}
                    onClick={() => setOpen(false)}
                    className={path === url ? "nav-item selected" : "nav-item"}
                    href={url}
                  >
                    <Icon size={18} />
                    {t(label)}
                  </Link>
                ))}
              </nav>
            </>
          )}
          <div className="sidebar-bottom">
            <div className="secure-note">
              <ShieldCheck size={16} />
              {t("Access is checked on the server.")}
            </div>
            <div className="profile">
              <span className="avatar">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>
                  {t(user.role === "ADMIN" ? "Administrator" : "Staff")}
                </small>
              </div>
              <button
                className="icon-button"
                aria-label={t("Sign out")}
                onClick={async () => {
                  await api("logout", {});
                  router.push("/login");
                  router.refresh();
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                ref={menuButton}
                aria-label="Menu"
                aria-expanded={open}
                aria-controls="workspace-navigation"
                onClick={() => setOpen(!open)}
              >
                <Menu size={20} />
              </button>
              <PanelLeftClose size={17} />
              <span className="divider" />
              {t("Workspace")}
              <span className="slash">/</span>
              <strong>
                {t(
                  [...nav, ...admin].find(([, url]) =>
                    path.startsWith(url),
                  )?.[0] ?? "Transfer details",
                )}
              </strong>
            </div>
            <div className="topbar-actions">
              <span className="company">MEHDI ALI TRADING Co.</span>
              <button
                className="language"
                onClick={async () => {
                  const value = locale === "en" ? "fa" : "en";
                  await api("me", { locale: value }, "PATCH");
                  setLocale(value);
                }}
              >
                <Globe size={15} />
                {locale === "en" ? "فارسی" : "English"}
              </button>
            </div>
          </header>
          <main>{children}</main>
          <footer className="app-footer">
            <span>
              BUZZ <span className="muted">/ {t("Internal transfers")}</span>
            </span>
            <span className="footer-dot" /> MEHDI ALI TRADING Co.
          </footer>
        </div>
      </div>
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
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{t(eyebrow)}</div>}
        <h1>{t(title)}</h1>
        {subtitle && <p>{t(subtitle)}</p>}
      </div>
      {action}
    </div>
  );
}
export function NewTransferLink() {
  const { t, user } = useBuzz();
  if (!hasMenu(user, "new-transfer")) return null;
  return (
    <Link className="button primary" href="/new-transfer">
      <Plus size={17} />
      {t("New transfer")}
    </Link>
  );
}
export function Status({ value }: { value: string }) {
  const { t } = useBuzz();
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      <span />
      {t(value[0] + value.slice(1).toLowerCase())}
    </span>
  );
}
