"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Overview, workspaceWords } from "@/lib/workspace";
import { money } from "@/lib/words";
import { operationLabel, operationDate } from "@/lib/operations";
function Trend({
  data,
  metric,
  locale,
}: {
  data: NonNullable<Overview["analytics"]>["daily"];
  metric: "views" | "orders" | "deliveredValue";
  locale: string;
}) {
  const gradient = useId().replace(/:/g, ""),
    values = data.map((d) => Number(d[metric])),
    max = Math.max(1, ...values),
    w = 800,
    h = 210;
  const points = values.map((v, i) => [
    35 + (i * (w - 55)) / Math.max(1, values.length - 1),
    h - 25 - (v / max) * (h - 55),
  ]);
  const path = points.map((p, i) => (i ? "L" : "M") + p.join(",")).join(" ");
  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={workspaceWords(locale).activity}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#32a87c" stopOpacity=".25" />
            <stop offset="100%" stopColor="#32a87c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="35"
              x2={w - 20}
              y1={h - 25 - v * (h - 55)}
              y2={h - 25 - v * (h - 55)}
              stroke="#e7ede8"
              strokeDasharray="4 5"
            />
            <text x="2" y={h - 21 - v * (h - 55)} fontSize="10" fill="#819188">
              {Math.round(max * v)}
            </text>
          </g>
        ))}
        <path
          d={path + ` L${w - 20},${h - 25} L35,${h - 25} Z`}
          fill={`url(#${gradient})`}
        />
        <path
          d={path}
          fill="none"
          stroke="#187855"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {[data[0], data[data.length - 1]].map(
          (d, i) =>
            d && (
              <text
                key={i}
                x={i ? w - 20 : 35}
                y={h - 3}
                fontSize="10"
                textAnchor={i ? "end" : "start"}
                fill="#819188"
              >
                {d.day}
              </text>
            ),
        )}
      </svg>
    </div>
  );
}
export function SellerOverview({
  locale,
  report = false,
}: {
  locale: string;
  report?: boolean;
}) {
  const t = workspaceWords(locale),
    [data, setData] = useState<Overview | null>(null),
    [days, setDays] = useState(30),
    [metric, setMetric] = useState<"views" | "orders" | "deliveredValue">(
      "views",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    setError("");
    api<Overview>("seller/insights?days=" + days)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [days]);
  const a = data?.analytics;
  return (
    <section className={"workspace-page " + (report ? "workspace-report" : "")}>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">
            {report ? "MENENWBKAM / REPORT" : t.workspace}
          </span>
          <h1>{report ? t.reportTitle : t.overview}</h1>
          <p>
            {data
              ? report
                ? data.store.businessName
                : t.welcome + " " + data.store.businessName
              : t.intro}
          </p>
        </div>
        <div className="actions no-print">
          <select
            aria-label={t.days}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 30, 90, 365].map((n) => (
              <option key={n} value={n}>
                {t.days}: {n}
              </option>
            ))}
          </select>
          {a && (
            <>
              <a
                className="button secondary"
                href={"/api/seller/insights/export.xlsx?days=" + days}
              >
                ↓ {t.excel}
              </a>
              <button
                className="secondary"
                onClick={() =>
                  report
                    ? window.print()
                    : window.location.assign("/" + locale + "/seller/reports")
                }
              >
                {t.pdf}
              </button>
            </>
          )}
          {!report && data?.permissions.includes("writeCatalog") && (
            <Link className="button" href={`/${locale}/seller/products`}>
              + {t.add}
            </Link>
          )}
        </div>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        error ? (
          <Link className="button" href={`/${locale}/seller/settings`}>
            {t.setup}
          </Link>
        ) : (
          <p>{t.loading}</p>
        )
      ) : (
        <>
          <div className="workspace-stats" aria-busy={busy}>
            {[
              {
                label: t.products,
                value: data.products,
                detail: data.plan,
                icon: "▦",
              },
              {
                label: t.newOrders,
                value: data.pendingOrders ?? "—",
                detail: t.orders,
                icon: "▤",
              },
              {
                label: t.views,
                value: a?.views ?? "—",
                detail: t.metricsNote.split(".")[0],
                icon: "◉",
              },
              {
                label: t.sales,
                value: a ? money(a.deliveredValue, locale) : "—",
                detail: a?.deliveredOrders + " " + t.orders,
                icon: "↗",
              },
            ].map((card, i) => (
              <article key={card.label} className="stat-card">
                <div className="stat-card-top">
                  <span>{card.label}</span>
                  <span className={"stat-icon tone-" + i} aria-hidden="true">
                    {card.icon}
                  </span>
                </div>
                <strong>{card.value}</strong>
                <small>{a || i < 2 ? card.detail : t.locked}</small>
              </article>
            ))}
          </div>
          {!a && (
            <div className="workspace-upgrade">
              <div>
                <h3>{t.locked}</h3>
                <p>{t.metricsNote}</p>
              </div>
              {data.role === "OWNER" && (
                <Link
                  className="button secondary"
                  href={`/${locale}/seller/billing`}
                >
                  {t.plans} ↗
                </Link>
              )}
            </div>
          )}
          {a && (
            <>
              <div className="workspace-chart-grid">
                <article className="workspace-card">
                  <div className="workspace-card-heading">
                    <h2>{t.activity}</h2>
                    <div className="chart-tabs">
                      {[
                        { id: "views", label: t.views },
                        { id: "orders", label: t.orders },
                        { id: "deliveredValue", label: t.sales },
                      ].map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className={metric === m.id ? "active" : ""}
                          onClick={() => setMetric(m.id as typeof metric)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Trend data={a.daily} metric={metric} locale={locale} />
                  <p className="chart-note">{t.metricsNote}</p>
                </article>
                <article className="workspace-card conversion-card">
                  <span className="eyebrow">{t.conversion}</span>
                  <div
                    className="conversion-ring"
                    style={{
                      background: `conic-gradient(#1c805e ${a.conversionRate * 3.6}deg,#eaf0e8 0deg)`,
                    }}
                  >
                    <div>
                      <strong>{a.conversionRate}%</strong>
                      <small>{t.conversion}</small>
                    </div>
                  </div>
                  <div className="conversion-counts">
                    <span>
                      {t.sessions}
                      <b>{a.sessions}</b>
                    </span>
                    <span>
                      {t.clicks}
                      <b>{a.clicks}</b>
                    </span>
                    <span>
                      {t.orders}
                      <b>{a.orders}</b>
                    </span>
                  </div>
                </article>
              </div>
              <article className="workspace-card">
                <div className="workspace-card-heading">
                  <h2>{t.top}</h2>
                  <span className="muted">SAR</span>
                </div>
                {!a.topProducts.length ? (
                  <p className="workspace-empty">{t.none}</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.products}</th>
                          <th>{t.orders}</th>
                          <th>{t.sales}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.topProducts.map((p, i) => (
                          <tr key={p.productId}>
                            <td>
                              <span className="rank-number">{i + 1}</span>
                              {p.title}
                            </td>
                            <td>{p.quantity}</td>
                            <td>
                              <strong>{money(p.value, locale)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </>
          )}
          {!report && (
            <div className="workspace-lower-grid">
              <article className="workspace-card">
                <div className="workspace-card-heading">
                  <h2>{t.recent}</h2>
                  {data.permissions.includes("orders") && (
                    <Link href={`/${locale}/seller/orders`}>{t.viewAll} ↗</Link>
                  )}
                </div>
                {!data.recent.length ? (
                  <p className="workspace-empty">{t.none}</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.orders}</th>
                          <th>{t.sales}</th>
                          <th>{locale === "ar" ? "الحالة" : "Status"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent.map((o) => (
                          <tr key={o.id}>
                            <td>
                              <Link href={`/${locale}/orders/${o.id}`}>
                                {o.number.slice(0, 13)}…
                              </Link>
                              <small className="block muted">
                                {operationDate(o.createdAt, locale)}
                              </small>
                            </td>
                            <td>{money(o.totalAmount, locale)}</td>
                            <td>
                              <span
                                className={
                                  "order-pill status-" + o.status.toLowerCase()
                                }
                              >
                                {operationLabel(o.status, locale)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
              <article className="workspace-card">
                <div className="workspace-card-heading">
                  <h2>{t.alerts}</h2>
                  <span className="alert-count">{data.lowStock}</span>
                </div>
                {!data.alerts.length ? (
                  <p className="workspace-empty">{t.noAlerts}</p>
                ) : (
                  data.alerts.map((alert) => (
                    <Link
                      key={alert.id}
                      className="workspace-alert"
                      href={`/${locale}/seller/insights`}
                    >
                      <span
                        className={
                          "alert-icon " +
                          (alert.kind === "LOW_STOCK" ? "stock" : "price")
                        }
                      >
                        {alert.kind === "LOW_STOCK" ? "!" : "↘"}
                      </span>
                      <div>
                        <strong>{alert.offer.title}</strong>
                        <small>
                          {alert.kind === "LOW_STOCK"
                            ? t.lowStock + " · " + alert.offer.stock
                            : t.drop +
                              " · " +
                              money(alert.data.competitorPrice || 0, locale)}
                        </small>
                      </div>
                      <span>↗</span>
                    </Link>
                  ))
                )}
              </article>
            </div>
          )}
          <p className="workspace-footnote">{t.reportNote}</p>
        </>
      )}
    </section>
  );
}
