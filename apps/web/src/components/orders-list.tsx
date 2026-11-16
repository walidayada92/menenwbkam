"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Order,
  Page,
  operationWords,
  operationLabel,
  operationDate,
} from "@/lib/operations";
import { money } from "@/lib/words";
export function OrdersList({
  locale,
  seller = false,
}: {
  locale: string;
  seller?: boolean;
}) {
  const t = operationWords(locale),
    [data, setData] = useState<Page<Order> | null>(null),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(
        await api<Page<Order>>(
          "orders?" +
            new URLSearchParams({
              page: String(page),
              ...(status ? { status } : {}),
            }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [page, status]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="content">
      <h1>{seller ? t.sellerOrders : t.orders}</h1>
      {error && (
        <p role="alert" className="notice">
          {error} <Link href={`/${locale}/account`}>{t.login}</Link>
        </p>
      )}
      <label>
        {t.status}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t.all}</option>
          {[
            "PENDING",
            "ACCEPTED",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            "RETURNED",
          ].map((s) => (
            <option key={s} value={s}>
              {operationLabel(s, locale)}
            </option>
          ))}
        </select>
      </label>
      {busy ? (
        <p>{t.loading}</p>
      ) : !data?.items.length ? (
        <p className="empty">{t.empty}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.seller}</th>
                <th>{t.status}</th>
                <th>{t.total}</th>
                <th>{t.date}</th>
                <th>{t.open}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id}>
                  <td>{o.number}</td>
                  <td>{o.seller.businessName}</td>
                  <td>
                    {operationLabel(o.status, locale)}
                    {o.dispute && <span className="badge">{t.dispute}</span>}
                  </td>
                  <td>{money(o.totalAmount, locale)}</td>
                  <td>{operationDate(o.createdAt, locale)}</td>
                  <td>
                    <Link
                      className="button secondary"
                      href={`/${locale}/orders/${o.id}`}
                    >
                      {t.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button disabled={busy || page === 1} onClick={() => setPage(page - 1)}>
          {t.previous}
        </button>
        <span>{page}</span>
        <button
          disabled={busy || !data || page * data.pageSize >= data.total}
          onClick={() => setPage(page + 1)}
        >
          {t.next}
        </button>
      </div>
    </section>
  );
}
