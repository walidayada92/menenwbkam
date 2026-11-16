"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { cartApi, checkoutReturn } from "@/lib/cart";
import { words } from "@/lib/words";
export function Account({ locale }: { locale: string }) {
  const t = words(locale);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api<User>("auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ user: User }>("auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (result.user.role === "SHOPPER") {
        await cartApi();
      }
      const next = result.user.role === "SHOPPER" ? checkoutReturn(locale) : null;
      window.location.assign(next || `/${locale}`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p>{t.loading}</p>;
  return (
    <section className="narrow">
      <h1>{t.account}</h1>
      {user ? (
        <div className="form-grid">
          <form
            className="panel form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const data = Object.fromEntries(new FormData(e.currentTarget));
                setUser(
                  await api<User>("auth/profile", {
                    method: "PUT",
                    body: JSON.stringify(data),
                  }),
                );
                setMessage(
                  locale === "ar" ? "تم حفظ الملف الشخصي." : "Profile saved.",
                );
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>{locale === "ar" ? "الملف الشخصي" : "Your profile"}</h2>
            <label>
              {locale === "ar" ? "الاسم" : "Name"}
              <input
                name="name"
                minLength={2}
                maxLength={100}
                defaultValue={user.name || ""}
                autoComplete="name"
                required
              />
            </label>
            <label>
              {t.email}
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={user.email}
                autoComplete="email"
              />
            </label>
            <label>
              {locale === "ar" ? "رقم الجوال" : "Phone number"}
              <input
                name="phone"
                type="tel"
                pattern="[+]?[0-9]{8,15}"
                placeholder="+966512345678"
                defaultValue={user.phone || ""}
                autoComplete="tel"
                required
              />
              <small className="muted">
                {locale === "ar"
                  ? "استخدم رمز الدولة، مثال: +966512345678"
                  : "Use country code, for example: +966512345678"}
              </small>
            </label>
            <p className="muted">
              {locale === "ar" ? "نوع الحساب" : "Account type"}: {user.role}
              {user.createdAt && (
                <>
                  {" "}
                  · {locale === "ar" ? "انضم في" : "Joined"}{" "}
                  {new Date(user.createdAt).toLocaleDateString(
                    locale === "ar" ? "ar-SA" : "en-US",
                  )}
                </>
              )}
            </p>
            {message && <p role="status">{message}</p>}
            <button disabled={busy}>
              {locale === "ar" ? "حفظ التغييرات" : "Save changes"}
            </button>
          </form>
          <div className="panel">
            <p>
              {t.signedIn}: {user.email}
            </p>
            {user.role === "SELLER" && (
              <Link className="button" href={`/${locale}/seller`}>
                {t.manage}
              </Link>
            )}
            {user.role === "SHOPPER" && (
              <Link className="button" href={`/${locale}/orders`}>
                {locale === "ar" ? "طلباتي" : "My orders"}
              </Link>
            )}
            {user.role === "ADMIN" && (
              <Link className="button" href={`/${locale}/admin`}>
                {t.admin}
              </Link>
            )}
            <button
              className="secondary"
              onClick={async () => {
                await api("session", { method: "DELETE" });
                setUser(null);
              }}
            >
              {t.logout}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p>
            {locale === "ar"
              ? "سجّل الدخول لإدارة حسابك."
              : "Sign in to manage your account."}
          </p>
          <form className="panel form-grid" onSubmit={submit}>
            <label>
              {t.email}
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label>
              {t.password}
              <input
                name="password"
                type="password"
                minLength={1}
                maxLength={72}
                required
                autoComplete="current-password"
              />
            </label>
            <button disabled={busy}>{busy ? t.loading : t.login}</button>
          </form>
          <p className="muted">
            {locale === "ar" ? "ليس لديك حساب؟" : "New here?"}{" "}
            <Link
              href={`/${locale}/signup${checkoutReturn(locale) ? `?next=${encodeURIComponent(checkoutReturn(locale)!)}` : ""}`}
            >
              {locale === "ar" ? "إنشاء حساب" : "Create an account"}
            </Link>
          </p>
        </>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
