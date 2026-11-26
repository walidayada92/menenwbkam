"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, Review, operationWords, operationDate } from "@/lib/operations";
export function Reviews({
  locale,
  productId,
  sellers,
}: {
  locale: string;
  productId?: string;
  sellers: { id: string; businessName: string }[];
}) {
  const t = operationWords(locale),
    [source, setSource] = useState(
      productId ? "products/" + productId : "sellers/" + sellers[0]?.id,
    ),
    [page, setPage] = useState(1),
    [data, setData] = useState<(Page<Review> & { rating: number }) | null>(
      null,
    ),
    [error, setError] = useState(""),
    [report, setReport] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setError("");
    setData(null);
    api<Page<Review> & { rating: number }>(
      "catalog/" + source + "/reviews?page=" + page,
    )
      .then(setData)
      .catch((e) => setError(e.message));
  }, [source, page]);
  return (
    <section className="panel">
      <h2>{t.reviews}</h2>
      <label>
        {t.target}
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
        >
          {productId && (
            <option value={"products/" + productId}>{t.product}</option>
          )}
          {Array.from(new Map(sellers.map((s) => [s.id, s])).values()).map(
            (s) => (
              <option key={s.id} value={"sellers/" + s.id}>
                {t.seller}: {s.businessName}
              </option>
            ),
          )}
        </select>
      </label>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!data ? (
        <p>{t.loading}</p>
      ) : (
        <>
          <p>
            {Number(data.rating).toFixed(1)} ★ · {data.total} {t.reviews}
          </p>
          {!data.items.length ? (
            <p>{t.noReviews}</p>
          ) : (
            data.items.map((r) => (
              <article className="review-card" key={r.id}>
                <strong>
                  {r.rating} ★ · {t.verified}
                </strong>
                <small>{operationDate(r.createdAt, locale)}</small>
                <p>{r.comment}</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setReport(report === r.id ? null : r.id)}
                >
                  {t.report}
                </button>
                {report === r.id && (
                  <form
                    className="form-grid"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        await api("operations/reviews/" + r.id + "/report", {
                          method: "POST",
                          body: JSON.stringify({
                            reason: new FormData(e.currentTarget).get("reason"),
                          }),
                        });
                        setReport(null);
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
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
                    <button disabled={busy}>{t.report}</button>
                  </form>
                )}
              </article>
            ))
          )}
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              {t.previous}
            </button>
            <span>{page}</span>
            <button
              disabled={page * data.pageSize >= data.total}
              onClick={() => setPage(page + 1)}
            >
              {t.next}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
