"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import {
  Order,
  operationWords,
  operationLabel,
  operationDate,
  orderTransitions,
} from "@/lib/operations";
import { money } from "@/lib/words";
export function OrderDetail({ locale, id }: { locale: string; id: string }) {
  const t = operationWords(locale),
    [order, setOrder] = useState<Order | null>(null),
    [user, setUser] = useState<User | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState("SELLER");
  const load = useCallback(async () => {
    const [o, u] = await Promise.all([
      api<Order>("orders/" + encodeURIComponent(id)),
      api<User>("auth/me"),
    ]);
    setOrder(o);
    setUser(u);
  }, [id]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function run(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function status(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    for (const key of ["trackingUrl", "deliveryMethod", "trackingNumber"])
      if (!data[key]) delete data[key];
    void run("orders/" + id + "/status", "PUT", data);
  }
  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void run("orders/" + id + "/reviews", "POST", {
      target: selectedReviewTarget,
      rating: Number(data.get("rating")),
      comment: data.get("comment"),
      ...(selectedReviewTarget === "PRODUCT"
        ? { productId: data.get("productId") }
        : {}),
    });
  }
  const sellerReviewAvailable = !order?.reviews.some(
    (r) => r.target === "SELLER",
  );
  const reviewProducts = Array.from(
    new Map(
      (order?.items || [])
        .filter(
          (item) =>
            !order?.reviews.some(
              (r) => r.target === "PRODUCT" && r.productId === item.productId,
            ),
        )
        .map((item) => [item.productId, item]),
    ).values(),
  );
  const selectedReviewTarget =
    target === "SELLER" && sellerReviewAvailable
      ? "SELLER"
      : reviewProducts.length
        ? "PRODUCT"
        : "SELLER";
  const transitions = order
    ? user?.role === "SELLER"
      ? orderTransitions[order.status] || []
      : user?.role === "SHOPPER" && order.status === "PENDING"
        ? ["CANCELLED"]
        : []
    : [];
  return (
    <section className="content">
      <Link
        href={`/${locale}/${user?.role === "SELLER" ? "seller/orders" : user?.role === "ADMIN" ? "admin/operations" : "orders"}`}
      >
        ← {t.back}
      </Link>
      <h1>{t.details}</h1>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!order ? (
        <p>
          {error ? (
            <Link href={`/${locale}/account`}>{t.login}</Link>
          ) : (
            t.loading
          )}
        </p>
      ) : (
        <>
          <div className="section-heading">
            <h2>{order.number}</h2>
            <span className="badge">
              {operationLabel(order.status, locale)}
            </span>
          </div>
          <p className="notice">{t.delivery}</p>
          <div className="dashboard-columns">
            <div className="panel">
              <h2>{t.items}</h2>
              {order.items.map((i) => (
                <p key={i.id}>
                  {i.title} × {i.quantity} · {money(i.priceAtPurchase, locale)}
                </p>
              ))}
              <strong className="price">
                {money(order.totalAmount, locale)}
              </strong>
              <p>{order.seller.businessName}</p>
            </div>
            <div className="panel">
              <h2>{t.address}</h2>
              <p>
                {order.recipientName}
                <br />
                {order.contactPhone}
                <br />
                {order.shippingAddress}
              </p>
              {order.notes && <p>{order.notes}</p>}
              {order.deliveryMethod && (
                <p>
                  {t.deliveryMethod}: {order.deliveryMethod}
                  <br />
                  {t.trackingNumber}: {order.trackingNumber}
                </p>
              )}
              {order.trackingUrl && (
                <a
                  className="button secondary"
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.track}
                </a>
              )}
            </div>
          </div>
          {transitions.length > 0 && (
            <form className="panel form-grid offer-form" onSubmit={status}>
              <h2 className="full-width">{t.update}</h2>
              <label>
                {t.status}
                <select name="status" required>
                  {transitions.map((s) => (
                    <option key={s} value={s}>
                      {operationLabel(s, locale)}
                    </option>
                  ))}
                </select>
              </label>
              {user?.role === "SELLER" && (
                <>
                  <label>
                    {t.deliveryMethod}
                    <input
                      name="deliveryMethod"
                      defaultValue={order.deliveryMethod || ""}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    {t.trackingNumber}
                    <input
                      name="trackingNumber"
                      defaultValue={order.trackingNumber || ""}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    {t.trackingUrl}
                    <input
                      name="trackingUrl"
                      type="url"
                      pattern="https://.*"
                      defaultValue={order.trackingUrl || ""}
                    />
                  </label>
                </>
              )}
              <label>
                {t.message}
                <textarea name="message" maxLength={2000} />
              </label>
              <button disabled={busy}>{t.save}</button>
            </form>
          )}
          <div className="panel">
            <h2>{t.timeline}</h2>
            <ol>
              {order.events.map((e) => (
                <li key={e.id}>
                  <strong>{operationLabel(e.status, locale)}</strong> ·{" "}
                  {operationDate(e.createdAt, locale)} ·{" "}
                  {operationLabel(e.actorRole, locale)}
                  {e.message && <p>{e.message}</p>}
                </li>
              ))}
            </ol>
          </div>
          <div className="panel">
            <h2>{t.reviews}</h2>
            {order.reviews.map((r) => (
              <p key={r.id}>
                {r.target === "SELLER" ? t.seller : t.product}: {r.rating} ★ ·{" "}
                {r.comment}
                {r.isHidden && (
                  <span className="badge">
                    {locale === "ar" ? "مخفي" : "Hidden"}
                  </span>
                )}
              </p>
            ))}
            {user?.role === "SHOPPER" &&
              (sellerReviewAvailable || reviewProducts.length > 0) &&
              ["DELIVERED", "RETURNED"].includes(order.status) && (
                <form
                  key={selectedReviewTarget}
                  className="form-grid"
                  onSubmit={review}
                >
                  <label>
                    {t.target}
                    <select
                      value={selectedReviewTarget}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      {sellerReviewAvailable && (
                        <option value="SELLER">{t.seller}</option>
                      )}
                      {reviewProducts.length > 0 && (
                        <option value="PRODUCT">{t.product}</option>
                      )}
                    </select>
                  </label>
                  {selectedReviewTarget === "PRODUCT" && (
                    <label>
                      {t.product}
                      <select name="productId">
                        {reviewProducts.map((i) => (
                          <option key={i.productId} value={i.productId}>
                            {i.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    {t.rating}
                    <select name="rating" defaultValue="5">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} ★
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t.comment}
                    <textarea
                      name="comment"
                      required
                      minLength={5}
                      maxLength={3000}
                    />
                  </label>
                  <button disabled={busy}>{t.review}</button>
                </form>
              )}
          </div>
          <div className="panel">
            <h2>{t.dispute}</h2>
            <p>{t.disputeNote}</p>
            {order.dispute ? (
              <>
                <span className="badge">
                  {operationLabel(order.dispute.status, locale)}
                </span>
                <p>{order.dispute.reason}</p>
                {order.dispute.messages.map((m) => (
                  <article className="dispute-message" key={m.id}>
                    <small>
                      {operationLabel(m.author.role, locale)} ·{" "}
                      {operationDate(m.createdAt, locale)}
                    </small>
                    <p>{m.body}</p>
                  </article>
                ))}
                {order.dispute.resolution && (
                  <p className="notice">
                    {t.resolution}: {order.dispute.resolution}
                  </p>
                )}
                {order.dispute.status !== "RESOLVED" && (
                  <form
                    className="form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      void run(
                        "operations/disputes/" +
                          order.dispute!.id +
                          "/messages",
                        "POST",
                        { body: data.get("body") },
                      );
                    }}
                  >
                    <label>
                      {t.message}
                      <textarea name="body" required maxLength={3000} />
                    </label>
                    <button disabled={busy}>{t.reply}</button>
                  </form>
                )}
                {user?.role === "ADMIN" &&
                  order.dispute.status !== "RESOLVED" && (
                    <form
                      className="form-grid"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        void run(
                          "admin/operations/disputes/" + order.dispute!.id,
                          "PUT",
                          {
                            status: data.get("status"),
                            ...(data.get("resolution")
                              ? { resolution: data.get("resolution") }
                              : {}),
                          },
                        );
                      }}
                    >
                      <label>
                        {t.status}
                        <select name="status">
                          <option value="UNDER_REVIEW">{t.underReview}</option>
                          <option value="RESOLVED">{t.resolve}</option>
                        </select>
                      </label>
                      <label>
                        {t.resolution}
                        <textarea name="resolution" maxLength={3000} />
                      </label>
                      <button disabled={busy}>{t.save}</button>
                    </form>
                  )}
              </>
            ) : (
              user?.role !== "ADMIN" && (
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("orders/" + id + "/dispute", "POST", {
                      reason: new FormData(e.currentTarget).get("reason"),
                    });
                  }}
                >
                  <label>
                    {t.reason}
                    <textarea
                      name="reason"
                      required
                      minLength={10}
                      maxLength={3000}
                    />
                  </label>
                  <button disabled={busy}>{t.openDispute}</button>
                </form>
              )
            )}
          </div>
        </>
      )}
    </section>
  );
}
