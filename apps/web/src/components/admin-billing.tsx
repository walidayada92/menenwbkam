"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money } from "@/lib/words";
import {
  Plan,
  Coupon,
  Invoice,
  billingWords,
  featureKeys,
  statusLabel,
} from "@/lib/billing";
const blank: Plan = {
  id: "",
  name: "",
  nameAr: "",
  monthlyPrice: "0",
  yearlyPrice: "0",
  productLimit: 10,
  features: {},
  isActive: true,
  isCustom: false,
  trialDays: 0,
  graceDays: 3,
  sortOrder: 0,
};
export function AdminBilling({ locale }: { locale: string }) {
  const t = billingWords(locale);
  const [plans, setPlans] = useState<Plan[]>([]),
    [coupons, setCoupons] = useState<Coupon[]>([]),
    [plan, setPlan] = useState<Plan>(blank),
    [coupon, setCoupon] = useState<Coupon | null>(null),
    [revenue, setRevenue] = useState<{
      testRevenueHalalas: number;
      testVatHalalas: number;
      liveRevenueHalalas: number;
      paidInvoices: number;
      invoices: Invoice[];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const [p, c, r] = await Promise.all([
      api<Plan[]>("admin/billing/plans"),
      api<Coupon[]>("admin/billing/coupons"),
      api<NonNullable<typeof revenue>>("admin/billing/revenue"),
    ]);
    setPlans(p);
    setCoupons(c);
    setRevenue(r);
  }, []);
  useEffect(() => {
    load()
      .catch((e) => setMessage(e.message))
      .finally(() => setReady(true));
  }, [load]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await load();
      setMessage(t.saved);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function savePlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget),
      features: Record<string, boolean> = {};
    for (const key of featureKeys) features[key] = data.get(key) === "on";
    void run(() =>
      api("admin/billing/plans/" + encodeURIComponent(String(data.get("id"))), {
        method: "PUT",
        body: JSON.stringify({
          name: data.get("name"),
          nameAr: data.get("nameAr"),
          monthlyPrice: Number(data.get("monthlyPrice")),
          yearlyPrice: Number(data.get("yearlyPrice")),
          productLimit: Number(data.get("productLimit")),
          trialDays: Number(data.get("trialDays")),
          graceDays: Number(data.get("graceDays")),
          sortOrder: Number(data.get("sortOrder")),
          isActive: data.get("isActive") === "on",
          isCustom: data.get("isCustom") === "on",
          features,
        }),
      }),
    );
  }
  function saveCoupon(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void run(async () => {
      await api("admin/billing/coupons" + (coupon ? "/" + coupon.id : ""), {
        method: coupon ? "PUT" : "POST",
        body: JSON.stringify({
          code: data.get("code"),
          percentOff: Number(data.get("percentOff")),
          maxRedemptions: Number(data.get("maxRedemptions")),
          isActive: data.get("isActive") === "on",
          ...(data.get("expiresAt")
            ? {
                expiresAt: new Date(
                  String(data.get("expiresAt")),
                ).toISOString(),
              }
            : {}),
        }),
      });
      setCoupon(null);
    });
  }
  return (
    <section className="content">
      <Link href={`/${locale}/admin`}>← {t.back}</Link>
      <h1>{t.admin}</h1>
      <p className="notice">{t.test}</p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {!ready ? (
        <p>{t.loading}</p>
      ) : !revenue ? (
        <Link href={`/${locale}/account`}>{t.login}</Link>
      ) : (
        <>
          <div className="dashboard-columns">
            <article className="panel">
              <h2>{t.revenue}</h2>
              <p className="price">
                {money(revenue.testRevenueHalalas / 100, locale)}
              </p>
              <p>
                {t.vat}: {money(revenue.testVatHalalas / 100, locale)}
              </p>
            </article>
            <article className="panel">
              <h2>{t.live}</h2>
              <p className="price">
                {money(revenue.liveRevenueHalalas / 100, locale)}
              </p>
              <p>{t.test}</p>
            </article>
          </div>
          <div className="section-heading">
            <h2>{t.plans}</h2>
            <select
              aria-label={t.plan}
              value={plan.id}
              onChange={(e) =>
                setPlan(plans.find((p) => p.id === e.target.value) || blank)
              }
            >
              <option value="">{t.newPlan}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === "ar" ? p.nameAr : p.name}
                </option>
              ))}
            </select>
          </div>
          <form
            key={plan.id}
            className="panel form-grid offer-form"
            onSubmit={savePlan}
          >
            <label>
              {t.id}
              <input
                name="id"
                defaultValue={plan.id}
                readOnly={!!plan.id}
                required
                pattern="[a-z0-9_-]{1,60}"
              />
            </label>
            <label>
              {t.name}
              <input
                name="name"
                defaultValue={plan.name}
                required
                maxLength={80}
              />
            </label>
            <label>
              {t.nameAr}
              <input
                name="nameAr"
                defaultValue={plan.nameAr}
                required
                maxLength={80}
              />
            </label>
            <label>
              {t.monthly}
              <input
                name="monthlyPrice"
                type="number"
                defaultValue={plan.monthlyPrice}
                required
                min="0"
                max="1000000"
                step=".01"
              />
            </label>
            <label>
              {t.yearly}
              <input
                name="yearlyPrice"
                type="number"
                defaultValue={plan.yearlyPrice}
                required
                min="0"
                max="1000000"
                step=".01"
              />
            </label>
            <label>
              {t.limit} (-1 = ∞)
              <input
                name="productLimit"
                type="number"
                defaultValue={plan.productLimit}
                required
                min="-1"
                max="1000000"
              />
            </label>
            <label>
              {t.trialDays}
              <input
                name="trialDays"
                type="number"
                defaultValue={plan.trialDays}
                required
                min="0"
                max="90"
              />
            </label>
            <label>
              {t.grace}
              <input
                name="graceDays"
                type="number"
                defaultValue={plan.graceDays}
                required
                min="0"
                max="30"
              />
            </label>
            <label>
              {t.sort}
              <input
                name="sortOrder"
                type="number"
                defaultValue={plan.sortOrder}
                required
                min="0"
                max="100"
              />
            </label>
            <div className="form-grid">
              {[
                ["isActive", t.active, plan.isActive],
                ["isCustom", t.customPlan, plan.isCustom],
              ].map(([key, label, checked]) => (
                <label className="check-label" key={String(key)}>
                  <input
                    name={String(key)}
                    type="checkbox"
                    defaultChecked={Boolean(checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <fieldset className="full-width">
              <legend>{t.features}</legend>
              <div className="billing-features">
                {featureKeys.map((key) => (
                  <label className="check-label" key={key}>
                    <input
                      type="checkbox"
                      name={key}
                      defaultChecked={plan.features[key] === true}
                    />
                    {t[key]}
                  </label>
                ))}
              </div>
            </fieldset>
            <button disabled={busy}>{t.save}</button>
          </form>
          <h2>{t.coupons}</h2>
          <div className="actions">
            <button className="secondary" onClick={() => setCoupon(null)}>
              {t.code} +
            </button>
            {coupons.map((c) => (
              <button
                className="secondary"
                key={c.id}
                onClick={() => setCoupon(c)}
              >
                {c.code} · {c.redemptionCount}/{c.maxRedemptions}
              </button>
            ))}
          </div>
          <form
            key={coupon?.id || "new-coupon"}
            className="panel form-grid offer-form"
            onSubmit={saveCoupon}
          >
            <label>
              {t.code}
              <input
                name="code"
                required
                pattern="[A-Za-z0-9_-]{1,40}"
                defaultValue={coupon?.code}
              />
            </label>
            <label>
              {t.percent}
              <input
                name="percentOff"
                type="number"
                required
                min="1"
                max="100"
                defaultValue={coupon?.percentOff || 10}
              />
            </label>
            <label>
              {t.maxUses}
              <input
                name="maxRedemptions"
                type="number"
                required
                min="1"
                max="1000000"
                defaultValue={coupon?.maxRedemptions || 100}
              />
            </label>
            <label>
              {t.expires}
              <input
                name="expiresAt"
                type="datetime-local"
                defaultValue={
                  coupon?.expiresAt
                    ? new Date(
                        new Date(coupon.expiresAt).getTime() -
                          new Date(coupon.expiresAt).getTimezoneOffset() *
                            60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>
            <label className="check-label">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={coupon?.isActive ?? true}
              />
              {t.active}
            </label>
            <button disabled={busy}>{t.save}</button>
          </form>
          <h2>{t.invoices}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.number}</th>
                  <th>{t.buyer}</th>
                  <th>{t.plan}</th>
                  <th>{t.total}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {revenue.invoices.map((i) => (
                  <tr key={i.id}>
                    <td>{i.number}</td>
                    <td>{i.buyerName}</td>
                    <td>{locale === "ar" ? i.planNameAr : i.planName}</td>
                    <td>{money(i.totalHalalas / 100, locale)}</td>
                    <td>{statusLabel(i.status, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
