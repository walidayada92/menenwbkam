"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/words";

export function PriceTracker({
  locale,
  productId,
  bestPrice,
}: {
  locale: string;
  productId: string;
  bestPrice: string;
}) {
  const ar = locale === "ar",
    [history, setHistory] = useState<{ day: string; price: string }[]>([]),
    [targetPrice, setTargetPrice] = useState(bestPrice),
    [message, setMessage] = useState("");
  useEffect(() => {
    api<{ day: string; price: string }[]>(
      `catalog/products/${productId}/price-history?days=90`,
    )
      .then(setHistory)
      .catch(() => undefined);
  }, [productId]);
  const max = Math.max(
    Number(bestPrice),
    ...history.map((point) => Number(point.price)),
  );
  return (
    <aside className="price-tracker panel">
      <h2>{ar ? "سجل السعر والتنبيه" : "Price history & alert"}</h2>
      <p>
        {ar ? "أقل سعر مُسجل" : "Lowest tracked price"}:{" "}
        {money(
          history.length
            ? Math.min(...history.map((point) => Number(point.price)))
            : Number(bestPrice),
          locale,
        )}
      </p>
      {history.length > 1 && (
        <div
          className="price-sparkline"
          aria-label={ar ? "سجل السعر" : "Price history"}
        >
          {history.map((point) => (
            <span
              key={point.day}
              title={`${point.day}: ${money(point.price, locale)}`}
              style={{
                height: `${Math.max(12, (Number(point.price) / max) * 100)}%`,
              }}
            />
          ))}
        </div>
      )}
      <form
        className="price-alert-form"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api("shopper/price-alerts", {
              method: "POST",
              body: JSON.stringify({ productId, targetPrice }),
            });
            setMessage(
              ar
                ? "سنرسل لك تنبيهًا عند وصول أفضل سعر إلى هدفك."
                : "We will notify you when the best price reaches your target.",
            );
          } catch {
            setMessage(
              ar
                ? "سجّل الدخول كمتسوق لإعداد تنبيه سعر."
                : "Sign in as a shopper to set a price alert.",
            );
          }
        }}
      >
        <label>
          {ar ? "نبّهني عند أو أقل من (ر.س)" : "Alert me at or below (SAR)"}
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            required
          />
        </label>
        <button>{ar ? "تعيين تنبيه السعر" : "Set price alert"}</button>
      </form>
      {message && <small role="status">{message}</small>}
    </aside>
  );
}
