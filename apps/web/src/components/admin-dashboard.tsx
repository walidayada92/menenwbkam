"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { words } from "@/lib/words";
import { Product, Seller, User } from "@/lib/types";
export function AdminDashboard({ locale }: { locale: string }) {
  const t = words(locale);
  const [user, setUser] = useState<User | null>(null),
    [sellers, setSellers] = useState<Seller[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [sellerPage, setSellerPage] = useState(1),
    [productPage, setProductPage] = useState(1);
  const load = useCallback(
    async (sellerNumber: number, productNumber: number) => {
      const [s, p] = await Promise.all([
        api<Seller[]>("admin/sellers?page=" + sellerNumber),
        api<Product[]>("admin/products?page=" + productNumber),
      ]);
      setSellers(s);
      setProducts(p);
      setSellerPage(sellerNumber);
      setProductPage(productNumber);
    },
    [],
  );
  useEffect(() => {
    api<User>("auth/me")
      .then(async (u) => {
        setUser(u);
        if (u.role === "ADMIN") await load(1, 1);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setReady(true));
  }, [load]);
  async function run(fn: () => Promise<unknown>, refresh = true) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      if (refresh) await load(sellerPage, productPage);
      setMessage(t.success);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function merge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (confirm(t.confirmMerge))
      void run(() =>
        api("admin/products/merge", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      );
  }
  function taxonomy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      await api("admin/" + data.get("kind"), {
        method: "POST",
        body: JSON.stringify({
          nameAr: data.get("nameAr"),
          nameEn: data.get("nameEn"),
        }),
      });
      form.reset();
    });
  }
  if (!ready) return <p className="content">{t.loading}</p>;
  if (user?.role !== "ADMIN")
    return (
      <section className="narrow">
        <p>{t.needAdmin}</p>
        <Link className="button" href={`/${locale}/account`}>
          {t.login}
        </Link>
      </section>
    );
  return (
    <section className="content">
      <h1>{t.admin}</h1>
      <p>
        <Link className="button" href={`/${locale}/admin/operations`}>
          {locale === "ar"
            ? "النزاعات وبلاغات التقييمات"
            : "Disputes & review reports"}
        </Link>
      </p>
      <p>
        <Link className="button" href={`/${locale}/admin/billing`}>
          {locale === "ar"
            ? "الخطط والخصومات والإيرادات"
            : "Plans, coupons & revenue"}
        </Link>
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <h2>{t.review}</h2>
      {!sellers.length ? (
        <p>{t.noSellers}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.business}</th>
                <th>{t.cr}</th>
                <th>{t.status}</th>
                <th>{t.review}</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.businessName}
                    <small className="block muted">{s.user?.email}</small>
                  </td>
                  <td>{s.commercialRegNo}</td>
                  <td>
                    {s.status === "APPROVED"
                      ? t.approved
                      : s.status === "REJECTED"
                        ? t.rejected
                        : t.pending}
                  </td>
                  <td>
                    <div className="actions">
                      {s.verificationName && (
                        <a
                          className="button secondary"
                          href={"/api/admin/sellers/" + s.id + "/verification"}
                        >
                          {t.document}
                        </a>
                      )}
                      <button
                        disabled={busy || !s.verificationName}
                        onClick={() =>
                          void run(() =>
                            api("admin/sellers/" + s.id + "/review", {
                              method: "PUT",
                              body: JSON.stringify({ status: "APPROVED" }),
                            }),
                          )
                        }
                      >
                        {t.approve}
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            api("admin/sellers/" + s.id + "/review", {
                              method: "PUT",
                              body: JSON.stringify({ status: "REJECTED" }),
                            }),
                          )
                        }
                      >
                        {t.reject}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={busy || sellerPage === 1}
          onClick={() =>
            void run(() => load(sellerPage - 1, productPage), false)
          }
        >
          {t.previous}
        </button>
        <span>{sellerPage}</span>
        <button
          className="secondary"
          disabled={busy || sellers.length < 50}
          onClick={() =>
            void run(() => load(sellerPage + 1, productPage), false)
          }
        >
          {t.next}
        </button>
      </div>
      <div className="dashboard-columns">
        <form className="panel form-grid" onSubmit={merge}>
          <h2>{t.merge}</h2>
          <p>{t.mergeHelp}</p>
          {["sourceId", "targetId"].map((name, i) => (
            <label key={name}>
              {i === 0 ? t.source : t.target}
              <input
                name={name}
                required
                list="merge-products"
                placeholder={t.product}
              />
            </label>
          ))}
          <datalist id="merge-products">
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand.nameEn} · {p.modelName}
              </option>
            ))}
          </datalist>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={busy || productPage === 1}
              onClick={() =>
                void run(() => load(sellerPage, productPage - 1), false)
              }
            >
              {t.previous}
            </button>
            <span>{productPage}</span>
            <button
              type="button"
              className="secondary"
              disabled={busy || products.length < 50}
              onClick={() =>
                void run(() => load(sellerPage, productPage + 1), false)
              }
            >
              {t.next}
            </button>
          </div>
          <button disabled={busy}>{t.merge}</button>
        </form>
        <form className="panel form-grid" onSubmit={taxonomy}>
          <h2>{t.taxonomy}</h2>
          <label>
            {t.category} / {t.brand}
            <select name="kind">
              <option value="categories">{t.category}</option>
              <option value="brands">{t.brand}</option>
            </select>
          </label>
          <label>
            {t.nameAr}
            <input name="nameAr" required maxLength={120} />
          </label>
          <label>
            {t.nameEn}
            <input name="nameEn" required maxLength={120} />
          </label>
          <button disabled={busy}>{t.submit}</button>
        </form>
      </div>
    </section>
  );
}
