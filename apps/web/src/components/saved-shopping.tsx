"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/words";
import { useShoppingAccess } from "./shopping-access";

type Saved = {
  wishlist: {
    productId: string;
    product: {
      id: string;
      modelName: string;
      images: string[];
      offers: { id: string; price: string; seller: { businessName: string } }[];
    };
  }[];
  lists: List[];
  alerts: {
    productId: string;
    targetPrice: string;
    product: { id: string; modelName: string };
  }[];
};
type List = {
  id: string;
  name: string;
  shareToken: string;
  total: string;
  sellers: {
    seller: { id: string; businessName: string };
    total: number;
    items: Item[];
  }[];
};
type Item = {
  id: string;
  quantity: number;
  available: boolean;
  subtotal: string;
  offer: {
    id: string;
    title: string;
    price: string;
    product: { id: string; modelName: string };
    seller: { businessName: string };
  };
};
const label = (locale: string, en: string, ar: string) =>
  locale === "ar" ? ar : en;

export function WishlistHeart({
  locale,
  productId,
}: {
  locale: string;
  productId: string;
}) {
  const canShop = useShoppingAccess();
  const [saved, setSaved] = useState(false),
    [message, setMessage] = useState("");
  const toggle = async () => {
    try {
      if (saved) {
        await api(`shopper/wishlist/${productId}`, { method: "DELETE" });
        setSaved(false);
      } else {
        await api("shopper/wishlist", {
          method: "POST",
          body: JSON.stringify({ productId }),
        });
        setSaved(true);
      }
    } catch {
      setMessage(
        label(
          locale,
          "Sign in as a shopper to save products.",
          "سجّل الدخول كمتسوق لحفظ المنتجات.",
        ),
      );
    }
  };
  if (!canShop) return null;
  return (
    <div className="wishlist-heart-wrap">
      <button
        type="button"
        className={`wishlist-heart${saved ? " saved" : ""}`}
        onClick={toggle}
        aria-label={label(locale, "Save to wishlist", "حفظ في المفضلة")}
        aria-pressed={saved}
        title={label(locale, "Save to wishlist", "حفظ في المفضلة")}
      >
        {saved ? "♥" : "♡"}
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}

export function SaveProduct({
  locale,
  productId,
  offerId,
}: {
  locale: string;
  productId: string;
  offerId?: string;
}) {
  const canShop = useShoppingAccess();
  const [saved, setSaved] = useState<Saved | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!canShop) return;
    api<Saved>("shopper/saved")
      .then(setSaved)
      .catch(() =>
        setMessage(
          label(
            locale,
            "Sign in as a shopper to save products.",
            "سجّل الدخول كمتسوق لحفظ المنتجات.",
          ),
        ),
      );
  }, [locale, canShop]);
  const addWish = async () => {
    try {
      await api("shopper/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId }),
      });
      setMessage(
        label(locale, "Saved to your wishlist.", "تم الحفظ في المفضلة."),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "");
    }
  };
  const addList = async (listId: string) => {
    if (!offerId) return;
    try {
      await api(`shopper/lists/${listId}/items`, {
        method: "POST",
        body: JSON.stringify({ offerId, quantity: 1 }),
      });
      setMessage(
        label(locale, "Added to the list.", "تمت الإضافة إلى القائمة."),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "");
    }
  };
  if (!canShop) return null;
  if (!saved)
    return (
      <div className="save-product">
        <button className="secondary" onClick={addWish}>
          {label(locale, "Save", "حفظ")}
        </button>
        {message && <small>{message}</small>}
      </div>
    );
  return (
    <div className="save-product">
      <button className="secondary" onClick={addWish}>
        {label(locale, "Save to wishlist", "حفظ في المفضلة")}
      </button>
      {offerId && saved.lists.length > 0 && (
        <select
          aria-label={label(locale, "Add to list", "أضف للقائمة")}
          defaultValue=""
          onChange={(e) => e.target.value && addList(e.target.value)}
        >
          <option value="">
            {label(locale, "Add to list…", "أضف للقائمة…")}
          </option>
          {saved.lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      )}
      {message && <small>{message}</small>}
    </div>
  );
}

export function SavedShopping({ locale }: { locale: string }) {
  const [saved, setSaved] = useState<Saved | null>(null),
    [name, setName] = useState(""),
    [message, setMessage] = useState("");
  const load = () =>
    api<Saved>("shopper/saved")
      .then(setSaved)
      .catch((e) => setMessage(e instanceof Error ? e.message : ""));
  useEffect(() => {
    void load();
  }, []);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("shopper/lists", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "");
    }
  };
  const removeWish = async (id: string) => {
    await api(`shopper/wishlist/${id}`, { method: "DELETE" });
    load();
  };
  const change = async (listId: string, itemId: string, quantity: number) => {
    await api(`shopper/lists/${listId}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    });
    load();
  };
  const removeItem = async (listId: string, itemId: string) => {
    await api(`shopper/lists/${listId}/items/${itemId}`, { method: "DELETE" });
    load();
  };
  const share = async (token: string) => {
    const url = `${location.origin}/${locale}/lists/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(label(locale, "Share link copied.", "تم نسخ رابط المشاركة."));
    } catch {
      setMessage(url);
    }
  };
  if (!saved)
    return (
      <section className="content">
        <h1>{label(locale, "Saved items", "العناصر المحفوظة")}</h1>
        <p>{message || label(locale, "Loading…", "جارٍ التحميل…")}</p>
      </section>
    );
  return (
    <section className="content saved-page">
      <div className="section-heading">
        <div>
          <h1>{label(locale, "Saved items", "العناصر المحفوظة")}</h1>
          <p>
            {label(
              locale,
              "Keep products for later and organise offers into shareable lists.",
              "احتفظ بالمنتجات لوقت لاحق ونظّم العروض في قوائم قابلة للمشاركة.",
            )}
          </p>
        </div>
      </div>
      {message && <p className="notice">{message}</p>}
      <div className="panel">
        <h2>{label(locale, "Wishlist", "المفضلة")}</h2>
        {saved.wishlist.length ? (
          <div className="saved-grid">
            {saved.wishlist.map(({ product }) => (
              <article key={product.id}>
                <Link href={`/${locale}/products/${product.id}`}>
                  <strong>{product.modelName}</strong>
                </Link>
                <p>
                  {product.offers[0]
                    ? `${money(product.offers[0].price, locale)} · ${product.offers[0].seller.businessName}`
                    : label(locale, "Currently unavailable", "غير متاح حاليًا")}
                </p>
                <button
                  className="secondary"
                  onClick={() => removeWish(product.id)}
                >
                  {label(locale, "Remove", "إزالة")}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p>
            {label(
              locale,
              "No saved products yet.",
              "لا توجد منتجات محفوظة بعد.",
            )}
          </p>
        )}
      </div>
      <div className="panel">
        <h2>{label(locale, "Price alerts", "تنبيهات الأسعار")}</h2>
        {saved.alerts.length ? (
          <div className="saved-grid">
            {saved.alerts.map((alert) => (
              <article key={alert.productId}>
                <Link href={`/${locale}/products/${alert.productId}`}>
                  <strong>{alert.product.modelName}</strong>
                </Link>
                <p>
                  {label(locale, "Target", "الهدف")}:{" "}
                  {money(alert.targetPrice, locale)}
                </p>
                <button
                  className="secondary"
                  onClick={async () => {
                    await api(`shopper/price-alerts/${alert.productId}`, {
                      method: "DELETE",
                    });
                    load();
                  }}
                >
                  {label(locale, "Remove alert", "إزالة التنبيه")}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p>
            {label(
              locale,
              "No active price alerts.",
              "لا توجد تنبيهات أسعار نشطة.",
            )}
          </p>
        )}
      </div>
      <div className="section-heading">
        <h2>{label(locale, "Shopping lists", "قوائم التسوق")}</h2>
      </div>
      <form className="create-list" onSubmit={create}>
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={label(
            locale,
            "e.g. New home essentials",
            "مثل: أساسيات المنزل الجديد",
          )}
        />
        <button>{label(locale, "Create list", "إنشاء قائمة")}</button>
      </form>
      {saved.lists.map((list) => (
        <article className="panel shopping-list" key={list.id}>
          <div className="section-heading">
            <div>
              <h3>{list.name}</h3>
              <strong className="price">{money(list.total, locale)}</strong>
            </div>
            <div className="actions">
              <button
                className="secondary"
                onClick={() => share(list.shareToken)}
              >
                {label(locale, "Share", "مشاركة")}
              </button>
              <button
                className="danger"
                onClick={async () => {
                  await api(`shopper/lists/${list.id}`, { method: "DELETE" });
                  load();
                }}
              >
                {label(locale, "Delete", "حذف")}
              </button>
            </div>
          </div>
          {list.sellers.map((group) => (
            <div className="seller-list-group" key={group.seller.id}>
              <h4>
                {group.seller.businessName}{" "}
                <small>{money(group.total, locale)}</small>
              </h4>
              {group.items.map((item) => (
                <div className="list-item" key={item.id}>
                  <Link href={`/${locale}/products/${item.offer.product.id}`}>
                    {item.offer.product.modelName}
                  </Link>
                  <span>{money(item.offer.price, locale)}</span>
                  {!item.available && (
                    <small className="unavailable">
                      {label(locale, "Unavailable", "غير متاح")}
                    </small>
                  )}
                  <input
                    aria-label={label(locale, "Quantity", "الكمية")}
                    type="number"
                    min="1"
                    max="100"
                    value={item.quantity}
                    onChange={(e) =>
                      change(list.id, item.id, Number(e.target.value))
                    }
                  />
                  <button
                    className="secondary"
                    onClick={() => removeItem(list.id, item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

export function SharedList({ locale, list }: { locale: string; list: List }) {
  return (
    <section className="content saved-page">
      <p className="eyebrow">
        {label(locale, "Shared shopping list", "قائمة تسوق مشتركة")}
      </p>
      <h1>{list.name}</h1>
      <p>
        {label(
          locale,
          "Live availability and prices are shown below.",
          "تظهر الأسعار والتوفر الحاليان أدناه.",
        )}
      </p>
      <div className="panel">
        <strong className="price">{money(list.total, locale)}</strong>
        {list.sellers.map((group) => (
          <div className="seller-list-group" key={group.seller.id}>
            <h2>{group.seller.businessName}</h2>
            {group.items.map((item) => (
              <div className="list-item" key={item.id}>
                <Link href={`/${locale}/products/${item.offer.product.id}`}>
                  {item.offer.product.modelName}
                </Link>
                <span>
                  {item.quantity} × {money(item.offer.price, locale)}
                </span>
                {item.available ? (
                  <Link
                    className="button"
                    href={`/${locale}/checkout/${item.offer.id}`}
                  >
                    {label(locale, "Order", "اطلب")}
                  </Link>
                ) : (
                  <small className="unavailable">
                    {label(locale, "Unavailable", "غير متاح")}
                  </small>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
