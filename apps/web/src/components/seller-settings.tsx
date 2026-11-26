"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Overview, workspaceWords } from "@/lib/workspace";
import { SellerDashboard } from "./seller-dashboard";
export function SellerSettings({ locale }: { locale: string }) {
  const t = workspaceWords(locale),
    [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [color, setColor] = useState("#126b50");
  const load = useCallback(
    () =>
      api<Overview>("seller/insights")
        .then((s) => {
          setData(s);
          setColor(s.store.brandColor);
        })
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
    window.addEventListener("workspace-updated", load);
    return () => window.removeEventListener("workspace-updated", load);
  }, [load]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("seller/workspaces/branding", {
        method: "PUT",
        body: JSON.stringify({
          slug: form.get("slug"),
          brandColor: color,
          description: form.get("description"),
          ...(form.get("logo") ? { logo: form.get("logo") } : {}),
          ...(form.get("bannerUrl")
            ? { bannerUrl: form.get("bannerUrl") }
            : {}),
          lowStockThreshold: Number(form.get("lowStockThreshold")),
          lowStockAlerts: form.get("lowStockAlerts") === "on",
          priceDropAlerts: form.get("priceDropAlerts") === "on",
        }),
      });
      await load();
      window.dispatchEvent(new Event("workspace-updated"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadImage(
    event: React.ChangeEvent<HTMLInputElement>,
    field: "logo" | "bannerUrl",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>("seller/branding-images", {
        method: "POST",
        body,
      });
      const input = document.querySelector<HTMLInputElement>(
        `input[name="${field}"]`,
      );
      if (input) input.value = url;
      event.target.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">{t.workspace}</span>
          <h1>{t.settings}</h1>
        </div>
        {data?.store.slug && (
          <Link
            className="button secondary"
            href={`/${locale}/stores/${data.store.slug}`}
          >
            {t.storefront} ↗
          </Link>
        )}
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {data && data.permissions.includes("branding") && (
        <div className="branding-grid">
          <form
            className="workspace-card form-grid"
            onSubmit={save}
            key={data.store.id}
          >
            <h2>{t.branding}</h2>
            <label>
              {t.slug}
              <input
                name="slug"
                required
                minLength={3}
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                defaultValue={data.store.slug || ""}
              />
            </label>
            <label>
              {t.logo}
              <input
                name="logo"
                type="text"
                defaultValue={data.store.logo || ""}
              />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => uploadImage(event, "logo")}
                disabled={busy}
              />
            </label>
            <label>
              {t.banner}
              <input
                name="bannerUrl"
                type="text"
                defaultValue={data.store.bannerUrl || ""}
              />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => uploadImage(event, "bannerUrl")}
                disabled={busy}
              />
            </label>
            <label>
              {t.color}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <label>
              {t.description}
              <textarea
                name="description"
                maxLength={2000}
                defaultValue={data.store.description || ""}
              />
            </label>
            <label>
              {t.threshold}
              <input
                name="lowStockThreshold"
                type="number"
                min="0"
                max="1000"
                required
                defaultValue={data.store.lowStockThreshold}
              />
            </label>
            <label className="check-label">
              <input
                name="lowStockAlerts"
                type="checkbox"
                defaultChecked={data.store.lowStockAlerts}
              />
              {t.stockAlerts}
            </label>
            <label className="check-label">
              <input
                name="priceDropAlerts"
                type="checkbox"
                defaultChecked={data.store.priceDropAlerts}
              />
              {t.priceAlerts}
            </label>
            <button disabled={busy}>{t.save}</button>
          </form>
          <article className="workspace-card brand-preview">
            <span className="eyebrow">{t.preview}</span>
            <div
              className="brand-preview-cover"
              style={{ background: color }}
            />
            {data.store.logo ? (
              <Image
                unoptimized
                src={data.store.logo}
                alt=""
                width={70}
                height={70}
              />
            ) : (
              <div className="brand-preview-logo" style={{ color }}>
                {data.store.businessName.slice(0, 1)}
              </div>
            )}
            <h2>{data.store.businessName}</h2>
            <p>{data.store.description}</p>
            <span
              className="button"
              style={{ background: color, borderColor: color }}
            >
              {t.storefront}
            </span>
          </article>
        </div>
      )}
      {(!data || data.role === "OWNER") && (
        <div className="legal-settings">
          <h2>{t.legal}</h2>
          <SellerDashboard locale={locale} profileOnly />
        </div>
      )}
    </section>
  );
}
