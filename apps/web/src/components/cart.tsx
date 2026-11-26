"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cartApi as api, Cart, cartSnapshot } from "@/lib/cart";
import { money } from "@/lib/words";
import { MenuIcon } from "./menu-icon";
import { useShoppingAccess } from "./shopping-access";

export function AddToCart({
  locale,
  offerId,
}: {
  locale: string;
  offerId: string;
}) {
  const canShop = useShoppingAccess();
  const ar = locale === "ar",
    [message, setMessage] = useState(""),
    [added, setAdded] = useState(false),
    [itemId, setItemId] = useState(""),
    [quantity, setQuantity] = useState(0);
  useEffect(() => {
    const update = (cart: Cart) => {
      const item = cart.sellers
        .flatMap((group) => group.items)
        .find((entry) => entry.offer.id === offerId);
      setItemId(item?.id || "");
      setQuantity(item?.quantity || 0);
    };
    const changed = (event: Event) =>
      update((event as CustomEvent<Cart>).detail);
    window.addEventListener("mw:cart-changed", changed);
    const cart = cartSnapshot();
    if (cart) update(cart);
    return () => window.removeEventListener("mw:cart-changed", changed);
  }, [offerId]);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 4000);
    return () => window.clearTimeout(timer);
  }, [added]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const applyCart = (cart: Cart) => {
    const item = cart.sellers
      .flatMap((group) => group.items)
      .find((entry) => entry.offer.id === offerId);
    setItemId(item?.id || "");
    setQuantity(item?.quantity || 0);
    setMessage("");
  };
  const reportError = (error: unknown) => {
    setAdded(false);
    setMessage(
      error instanceof Error &&
        error.message === "Quantity exceeds available stock"
        ? ar
          ? "وصلت إلى الحد المتاح في المخزون لهذا المنتج."
          : "You’ve reached the available stock for this product."
        : error instanceof Error
          ? error.message
          : ar
            ? "تعذر تحديث السلة."
            : "Unable to update the cart.",
    );
  };
  if (!canShop) return null;
  return (
    <span className="cart-button-wrap">
      {quantity === 0 ? (
        <button
          type="button"
          className="cart-icon"
          aria-label={ar ? "أضف إلى السلة" : "Add to cart"}
          title={ar ? "أضف إلى السلة" : "Add to cart"}
          onClick={async () => {
            try {
              const cart = await api<Cart>("shopper/cart/items", {
                method: "POST",
                body: JSON.stringify({ offerId, quantity: 1 }),
              });
              applyCart(cart);
              setMessage("");
              setAdded(true);
            } catch (error) {
              setAdded(false);
              setMessage(
                error instanceof Error
                  ? error.message
                  : ar
                    ? "سجّل الدخول كمتسوق"
                    : "Sign in as a shopper",
              );
            }
          }}
        >
          🛒
        </button>
      ) : (
        <span className="card-stepper">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={async () => {
              try {
                const cart = await api<Cart>(`shopper/cart/items/${itemId}`, {
                  method: "PUT",
                  body: JSON.stringify({ quantity: quantity - 1 }),
                });
                applyCart(cart);
              } catch (error) {
                reportError(error);
              }
            }}
          >
            −
          </button>
          <output>{quantity}</output>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={async () => {
              try {
                const cart = await api<Cart>("shopper/cart/items", {
                  method: "POST",
                  body: JSON.stringify({ offerId, quantity: 1 }),
                });
                applyCart(cart);
              } catch (error) {
                reportError(error);
              }
            }}
          >
            +
          </button>
          <button
            type="button"
            aria-label={ar ? "إزالة من السلة" : "Remove from cart"}
            onClick={async () => {
              try {
                const cart = await api<Cart>(`shopper/cart/items/${itemId}`, {
                  method: "DELETE",
                });
                applyCart(cart);
                setAdded(false);
                setMessage("");
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Request failed",
                );
              }
            }}
          >
            <MenuIcon name="trash" />
          </button>
        </span>
      )}
      {message && <span role="status">{message}</span>}
      {added && !message && (
        <span role="status" className="cart-added-notice">
          {ar ? "تمت الإضافة إلى السلة" : "Added to cart"}
          <Link href={`/${locale}/cart`}>{ar ? "عرض السلة" : "View cart"}</Link>
        </span>
      )}
    </span>
  );
}
export function CartPage({ locale }: { locale: string }) {
  const ar = locale === "ar",
    [cart, setCart] = useState<Cart | null>(null),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      api<Cart>("shopper/cart")
        .then(setCart)
        .catch((e) => setError(e instanceof Error ? e.message : "")),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const changeQuantity = async (itemId: string, quantity: number) => {
    try {
      await api(`shopper/cart/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ quantity }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "");
    }
  };
  if (!cart)
    return (
      <section className="content">
        <h1>{ar ? "سلة التسوق" : "Your cart"}</h1>
        <p>{error || (ar ? "جارٍ التحميل…" : "Loading…")}</p>
      </section>
    );
  return (
    <section className="content cart-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {ar ? "جاهز للمقارنة" : "READY TO COMPARE"}
          </span>
          <h1>{ar ? "سلة التسوق" : "Your cart"}</h1>
        </div>
      </div>
      {!cart.sellers.length ? (
        <div className="empty">
          <p>{ar ? "سلتك فارغة." : "Your cart is empty."}</p>
          <Link className="button" href={`/${locale}`}>
            {ar ? "استكشف المنتجات" : "Explore products"}
          </Link>
        </div>
      ) : (
        <>
          {cart.sellers.map((group) => (
            <article className="panel cart-seller" key={group.seller.id}>
              <div className="section-heading">
                <h2>{group.seller.businessName}</h2>
                <strong>{money(group.total, locale)}</strong>
              </div>
              {group.items.map((item) => (
                <div className="cart-line" key={item.id}>
                  <Link href={`/${locale}/products/${item.offer.product.id}`}>
                    {item.offer.product.modelName}
                  </Link>
                  <span>{money(item.offer.price, locale)}</span>
                  <div className="cart-line-actions">
                    {item.available ? (
                      <div className="cart-line-controls">
                        <input
                          aria-label={ar ? "الكمية" : "Quantity"}
                          type="button"
                          className="secondary quantity-minus"
                          value="−"
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            changeQuantity(item.id, item.quantity - 1)
                          }
                        />
                        <output className="cart-quantity">
                          {item.quantity}
                        </output>
                        <button
                          type="button"
                          className="secondary quantity-plus"
                          aria-label="Increase quantity"
                          onClick={() =>
                            changeQuantity(item.id, item.quantity + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <small className="unavailable">
                        {ar ? "غير متاح" : "Unavailable"}
                      </small>
                    )}
                    <button
                      type="button"
                      className="secondary cart-line-remove"
                      aria-label={ar ? "إزالة من السلة" : "Remove from cart"}
                      title={ar ? "إزالة من السلة" : "Remove from cart"}
                      onClick={async () => {
                        await api(`shopper/cart/items/${item.id}`, {
                          method: "DELETE",
                        });
                        load();
                      }}
                    >
                      <MenuIcon name="trash" />
                    </button>
                  </div>
                </div>
              ))}
            </article>
          ))}
          <div className="cart-checkout-action">
            <strong className="price">{money(cart.total, locale)}</strong>
            <Link className="button" href={`/${locale}/checkout/cart`}>
              {ar ? "إتمام طلب السلة" : "Checkout cart"}
            </Link>
          </div>
        </>
      )}
      <p className="muted">
        {ar
          ? "تفصل السلة المنتجات حسب التاجر لأن كل طلب يُنفذ من تاجر واحد."
          : "Items are grouped by seller because each order is fulfilled by one seller."}
      </p>
    </section>
  );
}
