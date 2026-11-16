"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { cartApi, Cart } from "@/lib/cart";
import { MenuIcon } from "./menu-icon";

function LanguageLink({ path, ar }: { path: string; ar: boolean }) {
  const params = useSearchParams().toString();
  return (
    <Link href={path + (params ? `?${params}` : "")} lang={ar ? "en" : "ar"}>
      <MenuIcon name="globe" />
      {ar ? "English" : "العربية"}
    </Link>
  );
}

export function MainNav({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const pathname = usePathname();
  const languagePath = pathname.replace(
    /^\/(ar|en)(?=\/|$)/,
    ar ? "/en" : "/ar",
  );
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    let active = true;
    const cartChanged = (event: Event) => {
      if (!active) return;
      const cart = (event as CustomEvent<Cart>).detail;
      setCartCount(
        cart.sellers.reduce(
          (sum, group) =>
            sum + group.items.reduce((count, item) => count + item.quantity, 0),
          0,
        ),
      );
    };
    const refresh = () => {
      void cartApi().catch(() => {});
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === "mw_guest_cart" || event.key === null) refresh();
    };
    window.addEventListener("mw:cart-changed", cartChanged);
    window.addEventListener("mw:session-changed", refresh);
    window.addEventListener("storage", storageChanged);
    refresh();
    return () => {
      active = false;
      window.removeEventListener("mw:cart-changed", cartChanged);
      window.removeEventListener("mw:session-changed", refresh);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);
  useEffect(() => {
    let active = true;
    const sessionChanged = (event: Event) => {
      active = false;
      setUser((event as CustomEvent<User | null>).detail);
      setReady(true);
    };
    window.addEventListener("mw:session-changed", sessionChanged);
    api<User>("auth/me")
      .then((user) => {
        if (active) setUser(user);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      window.removeEventListener("mw:session-changed", sessionChanged);
    };
  }, []);
  return (
    <nav aria-label={ar ? "القائمة الرئيسية" : "Main navigation"}>
      {ready && user?.role !== "SELLER" && (
        <Link href={`/${locale}/cart`}>
          <MenuIcon name="cart" />
          {ar ? "السلة" : "Cart"}
          {cartCount > 0 && (
            <span
              className="cart-count"
              aria-label={
                ar
                  ? `${cartCount} منتجات في السلة`
                  : `${cartCount} items in cart`
              }
            >
              {cartCount}
            </span>
          )}
        </Link>
      )}
      {ready && user && (
        <Link href={`/${locale}/notifications`}>
          <MenuIcon name="notifications" />
          {ar ? "الإشعارات" : "Notifications"}
        </Link>
      )}
      {ready && user?.role === "SELLER" && (
        <Link href={`/${locale}/seller`}>
          <MenuIcon name="seller" />
          {ar ? "لوحة التاجر" : "Seller dashboard"}
        </Link>
      )}
      {ready && user?.role === "ADMIN" && (
        <Link href={`/${locale}/admin`}>
          <MenuIcon name="admin" />
          {ar ? "الإدارة" : "Admin"}
        </Link>
      )}
      {ready && !user && (
        <Link href={`/${locale}/signup`}>
          <MenuIcon name="signup" />
          {ar ? "إنشاء حساب" : "Sign up"}
        </Link>
      )}
      {ready && user ? (
        <details className="account-menu" key={pathname}>
          <summary>
            <MenuIcon name="account" />
            {ar ? "حسابي" : "Account"}
          </summary>
          <div className="account-menu-links">
            <Link href={`/${locale}/account`}>
              <MenuIcon name="account" />
              {ar ? "تفاصيل الحساب" : "Account details"}
            </Link>
            {user.role === "SHOPPER" && (
              <>
                <Link href={`/${locale}/saved`}>
                  <MenuIcon name="saved" />
                  {ar ? "المحفوظات" : "Saved"}
                </Link>
                <Link href={`/${locale}/orders`}>
                  <MenuIcon name="orders" />
                  {ar ? "الطلبات" : "Orders"}
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  await api("session", { method: "DELETE" });
                  window.location.assign(`/${locale}`);
                } catch {
                  window.alert(
                    ar
                      ? "تعذر تسجيل الخروج. حاول مرة أخرى."
                      : "Unable to sign out. Please try again.",
                  );
                }
              }}
            >
              {ar ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </details>
      ) : (
        <Link href={`/${locale}/account`}>
          <MenuIcon name="account" />
          {ar ? "حسابي" : "Account"}
        </Link>
      )}
      <Suspense
        fallback={
          <Link href={languagePath} lang={ar ? "en" : "ar"}>
            <MenuIcon name="globe" />
            {ar ? "English" : "العربية"}
          </Link>
        }
      >
        <LanguageLink path={languagePath} ar={ar} />
      </Suspense>
    </nav>
  );
}
