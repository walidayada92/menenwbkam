"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Page,
  Review,
  operationWords,
  operationLabel,
  operationDate,
} from "@/lib/operations";
interface DisputeRow {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  createdAt: string;
  order: { number: string; seller: { businessName: string } };
}
interface ReportRow {
  id: string;
  reason: string;
  resolvedAt: string | null;
  reviewId: string;
  review: Review;
  reporter: { email: string };
}
export function AdminOperations({ locale }: { locale: string }) {
  const t = operationWords(locale),
    [disputes, setDisputes] = useState<Page<DisputeRow> | null>(null),
    [reports, setReports] = useState<Page<ReportRow> | null>(null),
    [dp, setDp] = useState(1),
    [rp, setRp] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [d, r] = await Promise.all([
      api<Page<DisputeRow>>("admin/operations/disputes?page=" + dp),
      api<Page<ReportRow>>("admin/operations/reports?page=" + rp),
    ]);
    setDisputes(d);
    setReports(r);
  }, [dp, rp]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  return (
    <section className="content">
      <Link href={`/${locale}/admin`}>← {t.back}</Link>
      <h1>{t.admin}</h1>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <p>
        <Link className="button secondary" href={`/${locale}/orders`}>
          {t.orders}
        </Link>
      </p>
      <h2>{t.disputes}</h2>
      {!disputes ? (
        <p>{t.loading}</p>
      ) : !disputes.items.length ? (
        <p>{t.noDisputes}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.seller}</th>
                <th>{t.reason}</th>
                <th>{t.status}</th>
                <th>{t.date}</th>
                <th>{t.open}</th>
              </tr>
            </thead>
            <tbody>
              {disputes.items.map((d) => (
                <tr key={d.id}>
                  <td>{d.order.number}</td>
                  <td>{d.order.seller.businessName}</td>
                  <td>{d.reason}</td>
                  <td>{operationLabel(d.status, locale)}</td>
                  <td>{operationDate(d.createdAt, locale)}</td>
                  <td>
                    <Link
                      className="button"
                      href={`/${locale}/orders/${d.orderId}`}
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
        <button disabled={dp === 1} onClick={() => setDp(dp - 1)}>
          {t.previous}
        </button>
        <span>{dp}</span>
        <button
          disabled={!disputes || dp * 20 >= disputes.total}
          onClick={() => setDp(dp + 1)}
        >
          {t.next}
        </button>
      </div>
      <h2>{t.reports}</h2>
      {!reports ? (
        <p>{t.loading}</p>
      ) : !reports.items.length ? (
        <p>{t.noReports}</p>
      ) : (
        reports.items.map((r) => (
          <article className="panel" key={r.id}>
            <p>
              <strong>{r.review.rating} ★</strong> · {r.review.comment}
            </p>
            <p>
              {t.reason}: {r.reason}
            </p>
            <p>{r.reporter.email}</p>
            {r.resolvedAt ? (
              <span className="badge">
                {locale === "ar" ? "تمت المراجعة" : "Reviewed"}
              </span>
            ) : (
              <form
                className="form-grid"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  setBusy(true);
                  setError("");
                  try {
                    await api("admin/operations/reviews/" + r.reviewId, {
                      method: "PUT",
                      body: JSON.stringify({
                        isHidden: data.get("decision") === "hide",
                        reason: data.get("reason"),
                      }),
                    });
                    await load();
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  {t.moderationReason}
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={1000}
                  />
                </label>
                <label>
                  {t.status}
                  <select name="decision">
                    <option value="hide">{t.hide}</option>
                    <option value="keep">{t.keep}</option>
                  </select>
                </label>
                <button disabled={busy}>{t.save}</button>
              </form>
            )}
          </article>
        ))
      )}
      <div className="pagination">
        <button disabled={rp === 1} onClick={() => setRp(rp - 1)}>
          {t.previous}
        </button>
        <span>{rp}</span>
        <button
          disabled={!reports || rp * 20 >= reports.total}
          onClick={() => setRp(rp + 1)}
        >
          {t.next}
        </button>
      </div>
    </section>
  );
}
