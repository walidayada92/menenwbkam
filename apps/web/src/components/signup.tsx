"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { checkoutReturn } from "@/lib/cart";
import { api } from "@/lib/api";

export function Signup({ locale }: { locale: string }) {
  const ar = locale === "ar",
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    setReturnTo(checkoutReturn(locale));
  }, [locale]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("auth/register", {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      });
      const next = checkoutReturn(locale);
      if (next) {
        window.location.assign(
          `/${locale}/account?next=${encodeURIComponent(next)}`,
        );
        return;
      }
      setMessage(
        ar
          ? "تم إنشاء حسابك. يمكنك تسجيل الدخول الآن."
          : "Your account is ready. You can sign in now.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="signup-shell">
      <div className="signup-pitch">
        <Link href={`/${locale}`} className="logo">
          {ar ? "منين وبكام" : "Menenwbkam"}
          <span>●</span>
        </Link>
        <span className="eyebrow">{ar ? "تسوق أذكى" : "SHOP SMARTER"}</span>
        <h1>
          {ar
            ? "كل سعر واضح قبل أن تشتري."
            : "Every price, clearer before you buy."}
        </h1>
        <p>
          {ar
            ? "أنشئ حسابًا لحفظ المنتجات، إنشاء قوائم التسوق، واستقبال تنبيهات السعر."
            : "Create an account to save products, make shopping lists, and receive price alerts."}
        </p>
        <div className="signup-benefits">
          <span>
            ✓ {ar ? "المفضلة وقوائم التسوق" : "Wishlist and shopping lists"}
          </span>
          <span>✓ {ar ? "تنبيهات السعر" : "Price alerts"}</span>
          <span>✓ {ar ? "متابعة طلباتك" : "Order tracking"}</span>
        </div>
      </div>
      <div className="signup-card">
        <span className="eyebrow">{ar ? "حساب جديد" : "NEW ACCOUNT"}</span>
        <h2>{ar ? "أنشئ حسابك" : "Create your account"}</h2>
        <form className="form-grid" onSubmit={submit}>
          <label>
            {ar ? "الاسم" : "Name"}
            <input
              name="name"
              minLength={2}
              maxLength={100}
              autoComplete="name"
              required
            />
          </label>
          <label>
            {ar ? "البريد الإلكتروني" : "Email"}
            <input
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
            />
          </label>
          <label>
            {ar ? "رقم الجوال" : "Phone number"}
            <input
              name="phone"
              type="tel"
              pattern="[+]?[0-9]{8,15}"
              placeholder="+9665..."
              autoComplete="tel"
              required
            />
          </label>
          <label>
            {ar ? "نوع الحساب" : "Account type"}
            <select name="role" defaultValue="SHOPPER" required>
              <option value="SHOPPER">{ar ? "متسوق" : "Shopper"}</option>
              <option value="SELLER">{ar ? "تاجر" : "Seller"}</option>
            </select>
            <small>
              {ar
                ? "حساب التاجر يتطلب إكمال ملف المتجر والمراجعة قبل إضافة المنتجات."
                : "Seller accounts must complete store verification before listing products."}
            </small>
          </label>
          <label>
            {ar ? "كلمة المرور" : "Password"}
            <input
              name="password"
              type="password"
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <button disabled={busy}>
            {ar ? "إنشاء حساب" : "Create account"}
          </button>
        </form>
        <div className="signup-divider">
          <span>{ar ? "أو" : "OR"}</span>
        </div>
        <button
          type="button"
          className="google-button"
          disabled
          title={
            ar
              ? "يتطلب إعداد Google OAuth"
              : "Google OAuth configuration is required"
          }
        >
          <b>G</b>
          {ar ? "التسجيل باستخدام Google" : "Sign up with Google"}
        </button>
        <p className="muted">
          {ar ? "لديك حساب؟" : "Already have an account?"}{" "}
          <Link
            href={`/${locale}/account${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`}
          >
            {ar ? "سجّل الدخول" : "Sign in"}
          </Link>
        </p>
      </div>
    </section>
  );
}
