"use client";
import { Form } from "@/components/form";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeftRight, ShieldCheck, Globe } from "lucide-react";
import { api } from "@/lib/client";
import { translate, type Locale } from "@/lib/i18n";
export default function Login() {
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const t = (key: string) => translate(locale, key);
  return (
    <div
      className="login-page"
      dir={locale === "fa" ? "rtl" : "ltr"}
      lang={locale}
    >
      <section className="login-story">
        <Image src="/logo.jpeg" width={145} height={92} alt="BUZZ" priority />
        <div>
          <div className="eyebrow">MEHDI ALI TRADING Co.</div>
          <h1>{t("Work moves better together.")}</h1>
          <p>{t("Secure access to your inventory transfers.")}</p>
          <div className="login-route">
            <span>
              <PackageIcon />
              {t("From location")}
            </span>
            <ArrowRight size={20} />
            <span>
              <PackageIcon />
              {t("To location")}
            </span>
          </div>
        </div>
        <small>BUZZ / {t("Internal transfers")}</small>
      </section>
      <section className="login-form-wrap">
        <button
          className="language"
          onClick={() => setLocale(locale === "en" ? "fa" : "en")}
        >
          <Globe size={16} />
          {locale === "en" ? "فارسی" : "English"}
        </button>
        <Form
          locale={locale}
          key={admin ? "admin" : "code"}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const result = await api<{ next: string }>(
                "login",
                admin
                  ? { email: form.get("email"), password: form.get("password") }
                  : { accessCode: String(form.get("accessCode") ?? "").trim() },
              );
              router.push(result.next);
              router.refresh();
            } catch (err) {
              setError(t((err as Error).message));
              setBusy(false);
            }
          }}
        >
          <span className="login-icon">
            <ArrowLeftRight />
          </span>
          <h2>{t("Sign in to BUZZ")}</h2>
          <p>{t("Use your company account to continue.")}</p>
          {admin ? (
            <>
              <label>
                {t("Email")}
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  dir="ltr"
                />
              </label>
              <label>
                {t("Password")}
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  dir="ltr"
                />
              </label>
            </>
          ) : (
            <label>
              {t("Access code")}
              <input
                name="accessCode"
                type="password"
                autoComplete="current-password"
                required
                pattern="(?:[A-Za-z0-9_-]{8,32}|BUZZ-[A-Za-z0-9_-]{43})"
                placeholder={t("Enter your access code")}
                dir="ltr"
                spellCheck={false}
              />
            </label>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {t(busy ? "Signing in…" : "Sign in")}
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setAdmin(!admin);
              setError("");
            }}
          >
            {t(admin ? "Use access code" : "Administrator sign in")}
          </button>
          <small>
            <ShieldCheck size={14} />
            {t("Contact your administrator for account access.")}
          </small>
        </Form>
      </section>
    </div>
  );
}
function PackageIcon() {
  return <span className="route-cube">◇</span>;
}
