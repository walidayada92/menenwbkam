"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

const ShoppingAccess = createContext(false);
export const useShoppingAccess = () => useContext(ShoppingAccess);

export function ShoppingAccessProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    let changed = false;
    const sessionChanged = (event: Event) => {
      changed = true;
      setUser((event as CustomEvent<User | null>).detail);
      setReady(true);
    };
    window.addEventListener("mw:session-changed", sessionChanged);
    api<User>("auth/me")
      .then((value) => {
        if (active && !changed) setUser(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active && !changed) setReady(true);
      });
    return () => {
      active = false;
      window.removeEventListener("mw:session-changed", sessionChanged);
    };
  }, []);
  return (
    <ShoppingAccess.Provider
      value={ready && (!user || user.role === "SHOPPER")}
    >
      {user?.role === "SELLER" && (
        <aside
          className="seller-account-banner"
          aria-label={locale === "ar" ? "حساب تاجر" : "Seller account"}
        >
          <div>
            <strong>
              {locale === "ar"
                ? "أنت تستخدم حساب تاجر"
                : "You’re using a seller account"}
            </strong>
            <p>
              {locale === "ar"
                ? "يمكنك تصفح المنتجات وإضافة منتجاتك للبيع وإدارة متجرك من لوحة التاجر. السلة والمفضلة مخصصتان لحسابات المتسوقين."
                : "Browse products, list your own products for sale, and manage your store. Cart and wishlist are for shopper accounts."}
            </p>
          </div>
          <Link className="button" href={`/${locale}/seller/products`}>
            {locale === "ar" ? "إدارة منتجاتي" : "Manage my products"}
          </Link>
        </aside>
      )}
      {children}
    </ShoppingAccess.Provider>
  );
}
