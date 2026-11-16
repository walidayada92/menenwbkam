"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { words, money } from "@/lib/words";
import { Seller, Listing, Taxonomy, User } from "@/lib/types";
export function SellerDashboard({
  locale,
  profileOnly = false,
}: {
  locale: string;
  profileOnly?: boolean;
}) {
  const t = words(locale);
  const [seller, setSeller] = useState<Seller | null>(null),
    [offers, setOffers] = useState<Listing[]>([]),
    [taxonomy, setTaxonomy] = useState<Taxonomy>({
      brands: [],
      categories: [],
    }),
    [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<Listing | null>(null),
    [formOpen, setFormOpen] = useState(false);
  const load = useCallback(async () => {
    const profile = await api<Seller | null>("seller/profile");
    setSeller(profile);
    if (profile && !profileOnly)
      setOffers(await api<Listing[]>("seller/offers"));
    setTaxonomy(await api<Taxonomy>("catalog/taxonomy"));
  }, [profileOnly]);
  useEffect(() => {
    api<User>("auth/me")
      .then(async (u) => {
        setUser(u);
        if (u.role === "SELLER") await load();
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setReady(true));
  }, [load]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await load();
      setMessage(t.success);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    void run(() =>
      api("seller/profile", { method: "PUT", body: JSON.stringify(data) }).then(
        () => window.dispatchEvent(new Event("workspace-updated")),
      ),
    );
  }
  function upload(e: FormEvent<HTMLFormElement>, path: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      await api(path, { method: "POST", body: data });
      form.reset();
    });
  }
  function uploadProductImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    void run(async () => {
      const { url } = await api<{ url: string }>("seller/product-images", {
        method: "POST",
        body: data,
      });
      const images = document.querySelector<HTMLTextAreaElement>(
        'textarea[name="images"]',
      );
      if (images)
        images.value = [images.value.trim(), url].filter(Boolean).join("\n");
      e.target.value = "";
    });
  }
  function saveOffer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const payload = {
      ...data,
      isFeatured: data.isFeatured === "on",
      price: Number(data.price),
      stock: Number(data.stock),
      images: String(data.images)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    for (const key of ["barcode", "sku", "productUrl"])
      if (!payload[key as keyof typeof payload])
        delete (payload as Record<string, unknown>)[key];
    void run(async () => {
      await api("seller/offers" + (editing ? "/" + editing.id : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setEditing(null);
      setFormOpen(false);
    });
  }
  const label = (item: { nameAr: string; nameEn: string }) =>
    locale === "ar" ? item.nameAr : item.nameEn;
  const status =
    seller?.status === "APPROVED"
      ? t.approved
      : seller?.status === "REJECTED"
        ? t.rejected
        : t.pending;
  const canWrite =
    !seller?.workspaceRole ||
    ["OWNER", "MANAGER", "CATALOG"].includes(seller.workspaceRole);
  if (!ready) return <p className="content">{t.loading}</p>;
  if (user?.role !== "SELLER")
    return (
      <section className="narrow">
        <p>{t.needSeller}</p>
        <Link className="button" href={`/${locale}/account`}>
          {t.login}
        </Link>
      </section>
    );
  return (
    <section className="content">
      <div className="section-heading">
        <h1>{profileOnly ? t.profile : t.offers}</h1>
        {seller && (
          <span className="badge">
            {status} · {seller._count?.offers || 0} /{" "}
            {seller.plan?.productLimit === -1
              ? "∞"
              : (seller.plan?.productLimit ?? 10)}{" "}
            {t.limit}
          </span>
        )}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {profileOnly && (
        <div className="dashboard-columns">
          <div className="panel">
            <h2>{t.profile}</h2>
            <form
              className="form-grid"
              onSubmit={saveProfile}
              key={seller?.id || "new"}
            >
              <label>
                {t.business}
                <input
                  name="businessName"
                  required
                  minLength={2}
                  maxLength={160}
                  defaultValue={seller?.businessName}
                />
              </label>
              <label>
                {t.cr}
                <input
                  name="commercialRegNo"
                  required
                  pattern="[0-9]{10}"
                  inputMode="numeric"
                  defaultValue={seller?.commercialRegNo || ""}
                />
              </label>
              <label>
                {t.description}
                <textarea
                  name="description"
                  maxLength={2000}
                  defaultValue={seller?.description || ""}
                />
              </label>
              <button disabled={busy}>{t.submit}</button>
            </form>
          </div>
          <div className="panel">
            <h2>{t.verification}</h2>
            <p>{t.approval}</p>
            {seller?.verificationName && <p>✓ {seller.verificationName}</p>}
            <form
              className="form-grid"
              onSubmit={(e) => upload(e, "seller/verification")}
            >
              <input
                aria-label={t.verification}
                name="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                required
                disabled={!seller}
              />
              <button disabled={busy || !seller}>{t.upload}</button>
            </form>
          </div>
        </div>
      )}
      {!profileOnly && (
        <>
          <div className="section-heading">
            <h2>{t.offers}</h2>
            {!formOpen && canWrite && (
              <button
                type="button"
                disabled={busy || formOpen || seller?.status !== "APPROVED"}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                {t.add} +
              </button>
            )}
          </div>
          {formOpen && (
            <form
              className="panel form-grid offer-form"
              key={editing?.id || "new"}
              onSubmit={saveOffer}
              aria-busy={busy}
            >
              <p className="full-width" role="status">
                {locale === "ar"
                  ? "احفظ هذا المنتج أو ألغِ التعديل قبل إدارة المنتجات الأخرى."
                  : "Save or cancel this product before managing other products."}
              </p>
              <label>
                {t.product}
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={200}
                  defaultValue={editing?.title}
                />
              </label>
              <label>
                {t.brand}
                <select
                  name="brandId"
                  required
                  defaultValue={editing?.product.brandId || ""}
                >
                  <option value="">{t.brand}</option>
                  {taxonomy.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {label(b)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.category}
                <select
                  name="categoryId"
                  required
                  defaultValue={editing?.product.categoryId || ""}
                >
                  <option value="">{t.category}</option>
                  {taxonomy.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {label(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.barcode}
                <input
                  name="barcode"
                  pattern="([0-9]{8}|[0-9]{12,14})"
                  defaultValue={editing?.product.barcode || ""}
                />
              </label>
              <label>
                {t.price}
                <input
                  name="price"
                  type="number"
                  required
                  min=".01"
                  step=".01"
                  defaultValue={editing?.price}
                />
              </label>
              <label>
                {t.stock}
                <input
                  name="stock"
                  type="number"
                  required
                  min="0"
                  step="1"
                  defaultValue={editing?.stock ?? 0}
                />
              </label>
              <label>
                {t.sku}
                <input
                  name="sku"
                  maxLength={100}
                  defaultValue={editing?.sku || ""}
                />
              </label>
              <label>
                {t.url}
                <input
                  name="productUrl"
                  type="url"
                  pattern="https://.*"
                  defaultValue={editing?.productUrl || ""}
                />
              </label>
              <label>
                {t.arabicDescription}
                <textarea
                  name="descriptionAr"
                  maxLength={5000}
                  defaultValue={editing?.descriptionAr || ""}
                />
              </label>
              <label>
                {t.englishDescription}
                <textarea
                  name="descriptionEn"
                  maxLength={5000}
                  defaultValue={editing?.descriptionEn || ""}
                />
              </label>
              <label className="full-width">
                {t.images}
                <textarea
                  name="images"
                  defaultValue={editing?.images.join("\n") || ""}
                />
                <span className="image-upload">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={uploadProductImage}
                    disabled={busy}
                  />
                  <small>
                    {locale === "ar"
                      ? "أو اختر صورة PNG أو JPG أو WebP (حتى 5 ميجابايت)"
                      : "Or choose a PNG, JPG, or WebP image (up to 5 MB)"}
                  </small>
                </span>
              </label>
              {seller?.features?.featuredBadge && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    defaultChecked={editing?.isFeatured}
                  />
                  {locale === "ar" ? "شارة مميزة" : "Featured badge"}
                </label>
              )}
              <div className="actions">
                <button type="submit" disabled={busy}>
                  {t.submit}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                  }}
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          )}
          {!formOpen &&
            (!offers.length ? (
              <p className="empty">{t.noOffers}</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.product}</th>
                      <th>{t.price}</th>
                      <th>{t.stock}</th>
                      {!formOpen && canWrite && <th>{t.edit}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {o.title}
                          <small className="muted block">{o.sku}</small>
                        </td>
                        <td>{money(o.price, locale)}</td>
                        <td>{o.stock}</td>
                        {!formOpen && canWrite && (
                          <td className="actions">
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy || seller?.status !== "APPROVED"}
                              onClick={() => {
                                setEditing(o);
                                setFormOpen(true);
                              }}
                            >
                              {t.edit}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              disabled={busy}
                              onClick={() => {
                                if (confirm(t.confirmDelete))
                                  void run(() =>
                                    api("seller/offers/" + o.id, {
                                      method: "DELETE",
                                    }),
                                  );
                              }}
                            >
                              {t.remove}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          {canWrite && (
            <div className="panel">
              <h2>{t.bulk}</h2>
              {!seller?.features?.bulkUpload && (
                <p>
                  <Link href={`/${locale}/seller/billing`}>
                    {locale === "ar"
                      ? "الرفع الجماعي يتطلب خطة تتضمن هذه الميزة. عرض الخطط"
                      : "Bulk upload requires a plan with this feature. View plans"}
                  </Link>
                </p>
              )}
              <p>{t.bulkHelp}</p>
              <a href="/import-template.csv" download>
                {t.template}
              </a>
              <p className="muted">
                {t.brand}:{" "}
                {taxonomy.brands
                  .map((b) => label(b) + " = " + b.id)
                  .join(" · ")}
                <br />
                {t.category}:{" "}
                {taxonomy.categories
                  .map((c) => label(c) + " = " + c.id)
                  .join(" · ")}
              </p>
              <form
                className="actions"
                onSubmit={(e) => upload(e, "seller/import")}
              >
                <input
                  name="file"
                  aria-label={t.bulk}
                  type="file"
                  accept=".csv,.xlsx"
                  required
                />
                <button
                  disabled={
                    busy ||
                    seller?.status !== "APPROVED" ||
                    !seller?.features?.bulkUpload
                  }
                >
                  {t.import}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  );
}
