"use client";
import { Form } from "@/components/form";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { translate, type Locale } from "@/lib/i18n";
export default function Setup() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const t = (key: string) => translate(locale, key);
  const [error, setError] = useState("");
  return (
    <div
      className="login-page"
      dir={locale === "fa" ? "rtl" : "ltr"}
      lang={locale}
    >
      <section className="login-story">
        <Image src="/logo.jpeg" width={145} height={92} alt="BUZZ" />
        <div>
          <div className="eyebrow">MEHDI ALI TRADING Co.</div>
          <h1>{t("Your workspace. Ready to move.")}</h1>
          <p>
            {t(
              "Create the first administrator account using your private setup link.",
            )}
          </p>
        </div>
        <small>BUZZ / {t("Secure first-time setup")}</small>
      </section>
      <section className="login-form-wrap">
        <button
          className="language"
          onClick={() => setLocale(locale === "en" ? "fa" : "en")}
        >
          {locale === "en" ? "فارسی" : "English"}
        </button>
        <Form
          locale={locale}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const f = new FormData(e.currentTarget);
            const token = new URLSearchParams(window.location.search).get(
              "token",
            );
            try {
              await api("setup", {
                token,
                email: f.get("email"),
                name: f.get("name"),
                password: f.get("password"),
              });
              router.replace("/dashboard");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <span className="eyebrow">{t("FIRST-TIME SETUP")}</span>
          <h2>{t("Welcome to BUZZ")}</h2>
          <p>{t("Set up your administrator account.")}</p>
          <label>
            {t("Name")}
            <input name="name" autoComplete="name" required maxLength={100} />
          </label>
          <label>
            {t("Email")}
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            {t("Password")}
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          {error && <div className="error">{t(error)}</div>}
          <button className="button primary">
            {t("Create administrator")}
          </button>
          <small>{t("Your password is hashed before it is saved.")}</small>
        </Form>
      </section>
    </div>
  );
}
