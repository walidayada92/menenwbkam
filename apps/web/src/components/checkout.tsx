"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { Quote, operationWords } from "@/lib/operations";
import { money } from "@/lib/words";
import { browsingVisitor } from "./engagement";
export function Checkout({
  locale,
  offerId,
}: {
  locale: string;
  offerId: string;
}) {
  const t = operationWords(locale),
    router = useRouter(),
    key = useRef<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [quantity, setQuantity] = useState(1);
  useEffect(() => {
    Promise.all([
      api<Quote>("catalog/offers/" + encodeURIComponent(offerId)).then(
        setQuote,
      ),
      api<User>("auth/me")
        .then(setUser)
        .catch(() => {}),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, [offerId]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    if (!key.current) key.current = crypto.randomUUID();
    try {
      const order = await api<{ id: string }>("orders", {
        method: "POST",
        body: JSON.stringify({
          checkoutKey: key.current,
          visitorId: browsingVisitor(),
          items: [{ offerId, quantity, expectedUnitPrice: quote.price }],
          recipientName: data.get("recipientName"),
          contactPhone: data.get("contactPhone"),
          shippingAddress: data.get("shippingAddress"),
          notes: data.get("notes"),
        }),
      });
      router.push("/" + locale + "/orders/" + order.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="narrow">
      <h1>{t.checkout}</h1>
      <p className="notice">{t.delivery}</p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!ready ? (
        <p>{t.loading}</p>
      ) : user?.role !== "SHOPPER" ? (
        <>
          <p>
            {locale === "ar"
              ? "أنشئ حسابًا أو سجّل الدخول لإتمام الطلب."
              : "Create an account or sign in to checkout."}
          </p>
          <Link
            className="button"
            href={`/${locale}/signup?next=${encodeURIComponent(`/${locale}/checkout/${offerId}`)}`}
          >
            {locale === "ar" ? "إنشاء حساب" : "Create account"}
          </Link>
          <Link
            href={`/${locale}/account?next=${encodeURIComponent(`/${locale}/checkout/${offerId}`)}`}
          >
            {t.login}
          </Link>
        </>
      ) : quote ? (
        <form className="panel form-grid" onSubmit={submit}>
          <h2>{quote.title}</h2>
          <p>
            {quote.seller.businessName} · {t.stock}: {quote.stock}
          </p>
          <label>
            {t.quantity}
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              min="1"
              max={Math.min(1000, quote.stock)}
              step="1"
            />
          </label>
          <strong className="price">
            {money(Number(quote.price) * quantity, locale)}
          </strong>
          <label>
            {t.name}
            <input
              name="recipientName"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <label>
            {t.phone}
            <input
              name="contactPhone"
              required
              type="tel"
              pattern="[+]?[0-9]{8,15}"
              autoComplete="tel"
            />
          </label>
          <label>
            {t.address}
            <textarea
              name="shippingAddress"
              required
              minLength={10}
              maxLength={1000}
              autoComplete="street-address"
            />
          </label>
          <label>
            {t.notes}
            <textarea name="notes" maxLength={2000} />
          </label>
          <label className="check-label">
            <input type="checkbox" required />
            {t.ack}
          </label>
          <button type="submit" disabled={busy}>
            {busy ? t.loading : t.submit}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              void api<Quote>("catalog/offers/" + encodeURIComponent(offerId))
                .then(setQuote)
                .catch((e) => setError(e.message));
            }}
          >
            {t.refresh}
          </button>
        </form>
      ) : null}
    </section>
  );
}
