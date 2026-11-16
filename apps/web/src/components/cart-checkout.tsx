"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cartApi } from "@/lib/cart";
import { User } from "@/lib/types";
import { money } from "@/lib/words";
import { browsingVisitor } from "./engagement";

type Cart = {
  sellers: {
    seller: { id: string; businessName: string };
    total: string;
    items: {
      id: string;
      quantity: number;
      available: boolean;
      offer: { id: string; title: string; price: string };
    }[];
  }[];
  total: string;
};

export function CartCheckout({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const router = useRouter();
  const checkoutKeys = useRef(new Map<string, string>());
  const [cart, setCart] = useState<Cart | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      cartApi<Cart>("shopper/cart").then(setCart),
      api<User>("auth/me")
        .then(setUser)
        .catch(() => null),
    ])
      .catch((err) => setError((err as Error).message))
      .finally(() => setReady(true));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart) return;
    const unavailable = cart.sellers
      .flatMap((group) => group.items)
      .some((item) => !item.available);
    if (unavailable) {
      setError(
        ar
          ? "أزل المنتجات غير المتاحة قبل إتمام الطلب."
          : "Remove unavailable products before placing the order.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      for (const group of cart.sellers) {
        const checkoutKey =
          checkoutKeys.current.get(group.seller.id) || crypto.randomUUID();
        checkoutKeys.current.set(group.seller.id, checkoutKey);
        await api<{ id: string }>("orders", {
          method: "POST",
          body: JSON.stringify({
            checkoutKey,
            visitorId: browsingVisitor(),
            items: group.items.map((item) => ({
              offerId: item.offer.id,
              quantity: item.quantity,
              expectedUnitPrice: String(item.offer.price),
            })),
            recipientName: data.get("recipientName"),
            contactPhone: data.get("contactPhone"),
            shippingAddress: data.get("shippingAddress"),
            notes: data.get("notes"),
          }),
        });
        await Promise.all(
          group.items.map((item) =>
            cartApi(`shopper/cart/items/${item.id}`, { method: "DELETE" }),
          ),
        );
      }
      router.push(`/${locale}/orders`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!ready)
    return (
      <section className="narrow">
        <p>{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      </section>
    );
  if (user?.role !== "SHOPPER")
    return (
      <section className="narrow">
        <h1>{ar ? "إتمام الطلب" : "Checkout"}</h1>
        <p>
          {ar
            ? "أنشئ حسابًا أو سجّل الدخول لإتمام الطلب."
            : "Create an account or sign in to checkout."}
        </p>
        <Link
          className="button"
          href={`/${locale}/signup?next=${encodeURIComponent(`/${locale}/checkout/cart`)}`}
        >
          {ar ? "إنشاء حساب" : "Create account"}
        </Link>
        <Link
          href={`/${locale}/account?next=${encodeURIComponent(`/${locale}/checkout/cart`)}`}
        >
          {ar ? "لديك حساب بالفعل؟ سجّل الدخول" : "Already have an account? Sign in"}
        </Link>
      </section>
    );
  if (error && !cart)
    return (
      <section className="narrow">
        <p role="alert">{error}</p>
        <Link href={`/${locale}/cart`}>
          {ar ? "العودة إلى السلة" : "Back to cart"}
        </Link>
      </section>
    );
  if (!cart?.sellers.length)
    return (
      <section className="narrow">
        <h1>{ar ? "إتمام الطلب" : "Checkout"}</h1>
        <p>{ar ? "سلتك فارغة." : "Your cart is empty."}</p>
        <Link className="button" href={`/${locale}/cart`}>
          {ar ? "العودة إلى السلة" : "Back to cart"}
        </Link>
      </section>
    );

  return (
    <section className="narrow cart-checkout">
      <h1>{ar ? "إتمام طلب السلة" : "Checkout your cart"}</h1>
      <p className="notice">
        {ar
          ? "سيتم إنشاء طلب مستقل لكل متجر في سلتك."
          : "A separate order will be created for each store in your cart."}
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <form className="panel form-grid" onSubmit={submit}>
        <div className="cart-checkout-summary">
          <strong>{ar ? "ملخص السلة" : "Cart summary"}</strong>
          {cart.sellers.map((group) => (
            <p key={group.seller.id}>
              {group.seller.businessName} ·{" "}
              {group.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
              {ar ? "منتج" : "item(s)"}{" "}
              <span>{money(group.total, locale)}</span>
            </p>
          ))}
          <strong className="price">{money(cart.total, locale)}</strong>
        </div>
        <label>
          {ar ? "الاسم" : "Name"}
          <input
            name="recipientName"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
          />
        </label>
        <label>
          {ar ? "رقم الجوال" : "Phone"}
          <input
            name="contactPhone"
            required
            type="tel"
            pattern="[+]?[0-9]{8,15}"
            autoComplete="tel"
          />
        </label>
        <label>
          {ar ? "عنوان التوصيل" : "Delivery address"}
          <textarea
            name="shippingAddress"
            required
            minLength={10}
            maxLength={1000}
            autoComplete="street-address"
          />
        </label>
        <label>
          {ar ? "ملاحظات" : "Notes"}
          <textarea name="notes" maxLength={2000} />
        </label>
        <label className="check-label">
          <input type="checkbox" required />
          {ar ? "أؤكد بيانات الطلب." : "I confirm my order details."}
        </label>
        <button type="submit" disabled={busy}>
          {busy
            ? ar
              ? "جارٍ الإرسال…"
              : "Placing order…"
            : ar
              ? "تأكيد طلب السلة"
              : "Place cart order"}
        </button>
      </form>
    </section>
  );
}
