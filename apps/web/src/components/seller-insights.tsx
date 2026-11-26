"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Insight, Alert, workspaceWords } from "@/lib/workspace";
import { Page, operationDate } from "@/lib/operations";
import { money } from "@/lib/words";
export function SellerInsights({ locale }: { locale: string }) {
  const t = workspaceWords(locale),
    [prices, setPrices] = useState<Page<Insight> | null>(null),
    [alerts, setAlerts] = useState<Page<Alert> | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [history, setHistory] = useState<
      { price: string; createdAt: string }[] | null
    >(null),
    [selected, setSelected] = useState("");
  const load = useCallback(async () => {
    setError("");
    const alertData = await api<Page<Alert>>(
      "seller/insights/alerts?page=" + page,
    );
    setAlerts(alertData);
    try {
      setPrices(
        await api<Page<Insight>>("seller/insights/prices?page=" + page),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  return (
    <section className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">{t.workspace}</span>
          <h1>{t.insights}</h1>
          <p>{t.priceNote}</p>
        </div>
        <Link className="button secondary" href={`/${locale}/seller/products`}>
          {t.products} ↗
        </Link>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-card">
        <h2>{t.alerts}</h2>
        {!alerts ? (
          <p>{t.loading}</p>
        ) : !alerts.items.length ? (
          <p className="workspace-empty">{t.noAlerts}</p>
        ) : (
          alerts.items.map((a) => (
            <article className="workspace-alert" key={a.id}>
              <span
                className={
                  "alert-icon " + (a.kind === "LOW_STOCK" ? "stock" : "price")
                }
              >
                {a.kind === "LOW_STOCK" ? "!" : "↘"}
              </span>
              <div>
                <strong>{a.offer.title}</strong>
                <small>
                  {a.kind === "LOW_STOCK"
                    ? t.stock + ": " + a.offer.stock
                    : t.drop +
                      ": " +
                      money(a.data.competitorPrice || 0, locale)}
                </small>
              </div>
            </article>
          ))
        )}
      </div>
      {prices && (
        <div className="workspace-card">
          <h2>{t.insights}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.products}</th>
                  <th>{t.price}</th>
                  <th>{t.best}</th>
                  <th>{t.position}</th>
                  <th>{t.suggestion}</th>
                  <th>{t.history}</th>
                </tr>
              </thead>
              <tbody>
                {prices.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      <small className="block muted">
                        {t.stock}: {p.stock}
                      </small>
                    </td>
                    <td>{money(p.price, locale)}</td>
                    <td>
                      {p.bestCompetitor ? (
                        <>
                          {money(p.bestCompetitor.price, locale)}
                          <small className="block muted">
                            {p.bestCompetitor.seller}
                          </small>
                        </>
                      ) : (
                        t.noCompetitor
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          p.position === 1
                            ? "order-pill status-delivered"
                            : "order-pill"
                        }
                      >
                        {p.position} / {p.competitorCount + 1}
                      </span>
                    </td>
                    <td>
                      {p.suggestedPrice ? money(p.suggestedPrice, locale) : "—"}
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={async () => {
                          setSelected(p.title);
                          setHistory(null);
                          setError("");
                          try {
                            setHistory(
                              await api(
                                "seller/insights/history/" + p.id + "?days=90",
                              ),
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {t.history}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {selected && (
        <div className="workspace-card">
          <h2>
            {t.history} · {selected}
          </h2>
          {history?.length ? (
            <ol className="price-timeline">
              {history.map((point, i) => (
                <li key={i}>
                  <strong>{money(point.price, locale)}</strong>
                  <span>{operationDate(point.createdAt, locale)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>{t.noHistory}</p>
          )}
        </div>
      )}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          ←
        </button>
        <span>{page}</span>
        <button
          disabled={!prices || page * 20 >= prices.total}
          onClick={() => setPage(page + 1)}
        >
          →
        </button>
      </div>
    </section>
  );
}
