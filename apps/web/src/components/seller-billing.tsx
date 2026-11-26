"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money } from "@/lib/words";
import {
  BillingState,
  Plan,
  billingWords,
  featureKeys,
  statusLabel,
} from "@/lib/billing";
export function SellerBilling({ locale }: { locale: string }) {
  const t = billingWords(locale);
  const [plans, setPlans] = useState<Plan[]>([]),
    [state, setState] = useState<BillingState | null>(null),
    [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY"),
    [coupon, setCoupon] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      api<Plan[]>("seller/billing/plans"),
      api<BillingState>("seller/billing"),
    ]);
    setPlans(p);
    setState(s);
  }, []);
  useEffect(() => {
    load()
      .catch((error) => setMessage(error.message))
      .finally(() => setReady(true));
  }, [load]);
  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setMessage("");
    try {
      await api("seller/billing/" + path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      setMessage(t.saved);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const planName = (p: Plan) => (locale === "ar" ? p.nameAr : p.name);
  return (
    <section className="content">
      <Link href={`/${locale}/seller`}>← {t.back}</Link>
      <h1>{t.title}</h1>
      <p className="notice">{t.test}</p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {!ready ? (
        <p>{t.loading}</p>
      ) : !state ? (
        <Link href={`/${locale}/account`}>{t.login}</Link>
      ) : (
        <>
          {!state.testEnabled && <p className="notice">{t.disabled}</p>}
          <div className="panel">
            <h2>
              {t.current}: {state.plan ? planName(state.plan) : t.free}
            </h2>
            <p>
              {t.status}: {statusLabel(state.status, locale)} · {t.count}:{" "}
              {state.offerCount} /{" "}
              {state.productLimit === -1 ? t.unlimited : state.productLimit}
            </p>
            {state.subscription && (
              <>
                <p>
                  {t.until}:{" "}
                  {new Date(state.subscription.endDate).toLocaleString(
                    locale === "ar" ? "ar-SA" : "en-GB",
                    { timeZone: "Asia/Riyadh" },
                  )}
                </p>
                {state.subscription.pendingPlanId && (
                  <p>
                    {t.queued}:{" "}
                    {plans.find(
                      (p) => p.id === state.subscription!.pendingPlanId,
                    )?.name || state.subscription.pendingPlanId}
                  </p>
                )}
                {state.subscription.cancelAtPeriodEnd && <p>{t.cancelled}</p>}
                {state.testEnabled &&
                  ["ACTIVE", "TRIALING", "GRACE_PERIOD"].includes(
                    state.status,
                  ) && (
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void action("simulate-time", { stage: "DUE" })
                        }
                      >
                        {locale === "ar"
                          ? "محاكاة نهاية الفترة"
                          : "Simulate period end"}
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void action("simulate-time", {
                            stage: "GRACE_EXPIRED",
                          })
                        }
                      >
                        {locale === "ar"
                          ? "محاكاة انتهاء السماح"
                          : "Simulate grace expiry"}
                      </button>
                    </div>
                  )}
                <div className="actions">
                  <button
                    disabled={
                      busy ||
                      !state.testEnabled ||
                      state.subscription.cancelAtPeriodEnd
                    }
                    onClick={() => void action("renew")}
                  >
                    {t.renew}
                  </button>
                  <button
                    className="danger"
                    disabled={busy || state.subscription.cancelAtPeriodEnd}
                    onClick={() => {
                      if (confirm(t.confirmCancel)) void action("cancel");
                    }}
                  >
                    {t.cancel}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="actions">
            <label>
              {t.monthly} / {t.yearly}
              <select
                value={interval}
                onChange={(e) =>
                  setInterval(e.target.value as "MONTHLY" | "YEARLY")
                }
              >
                <option value="MONTHLY">{t.monthly}</option>
                <option value="YEARLY">{t.yearly}</option>
              </select>
            </label>
            <label>
              {t.coupon}
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                maxLength={40}
              />
            </label>
          </div>
          <p>{t.yearlyNote}</p>
          <p>{t.pricing}</p>
          <div className="billing-plans">
            {plans.map((p) => (
              <article className="panel" key={p.id}>
                <h2>{planName(p)}</h2>
                <p className="price">
                  {p.isCustom
                    ? t.custom
                    : money(
                        interval === "YEARLY" ? p.yearlyPrice : p.monthlyPrice,
                        locale,
                      )}
                </p>
                <p>
                  {p.productLimit === -1 ? t.unlimited : p.productLimit}{" "}
                  {t.count}
                </p>
                <ul>
                  {featureKeys
                    .filter((key) => p.features[key])
                    .map((key) => (
                      <li key={key}>{t[key]}</li>
                    ))}
                </ul>
                {p.id !== "free" && !p.isCustom && (
                  <div className="form-grid">
                    {p.trialDays > 0 && state.trialAvailable && (
                      <button
                        className="secondary"
                        disabled={busy || !state.testEnabled}
                        onClick={() => void action("trial", { planId: p.id })}
                      >
                        {t.trial} · {p.trialDays} {t.days}
                      </button>
                    )}
                    <button
                      disabled={busy || !state.testEnabled}
                      onClick={() =>
                        void action("checkout", {
                          planId: p.id,
                          interval,
                          ...(coupon ? { coupon } : {}),
                        })
                      }
                    >
                      {t.buy}
                    </button>
                    {state.subscription && (
                      <button
                        className="secondary"
                        disabled={busy || !state.testEnabled}
                        onClick={() =>
                          void action("schedule", { planId: p.id, interval })
                        }
                      >
                        {t.schedule}
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          <p className="muted">{t.future}</p>
          <h2>{t.invoices}</h2>
          {!state.invoices.length ? (
            <p>{t.noInvoices}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.number}</th>
                    <th>{t.plan}</th>
                    <th>{t.total}</th>
                    <th>{t.status}</th>
                    <th>{t.view}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.invoices.map((i) => (
                    <tr key={i.id}>
                      <td>{i.number}</td>
                      <td>{locale === "ar" ? i.planNameAr : i.planName}</td>
                      <td>{money(i.totalHalalas / 100, locale)}</td>
                      <td>{statusLabel(i.status, locale)}</td>
                      <td>
                        <div className="actions">
                          <Link
                            className="button secondary"
                            href={`/${locale}/seller/billing/invoices/${i.id}`}
                          >
                            {t.view}
                          </Link>
                          {["OPEN", "FAILED"].includes(i.status) &&
                            state.testEnabled && (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void action(
                                      "invoices/" + i.id + "/simulate",
                                      { outcome: "paid" },
                                    )
                                  }
                                >
                                  {t.paid}
                                </button>
                                <button
                                  className="danger"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(
                                      "invoices/" + i.id + "/simulate",
                                      { outcome: "failed" },
                                    )
                                  }
                                >
                                  {t.failed}
                                </button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
