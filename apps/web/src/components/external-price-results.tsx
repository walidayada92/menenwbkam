"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Result = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  listings: {
    id: string;
    title: string;
    titleLocalized: boolean;
    titleLanguage: string;
    url: string;
    price: string;
    currency: string;
    availability: string;
    lastSeenAt: string | null;
    store: string;
    matchStatus?: string;
    comparisonProductId?: string | null;
  }[];
  stores: { store: string; name: string; searchUrl: string }[];
};
type DiscoveryStatus = { store: string; status: string; retryAt?: string };
export function ExternalPriceResults(props: {
  locale: string;
  query: string;
  productId?: string;
}) {
  return (
    <PriceTable
      key={`${props.locale}:${props.query}:${props.productId || ""}`}
      {...props}
    />
  );
}
function PriceTable({
  locale,
  query,
  productId,
}: {
  locale: string;
  query: string;
  productId?: string;
}) {
  const ar = locale === "ar";
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("price_asc");
  const [storeFilter, setStoreFilter] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [discovery, setDiscovery] = useState<DiscoveryStatus[]>([]);
  const [discoveryAttempt, setDiscoveryAttempt] = useState(0);
  useEffect(() => {
    if (productId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;
    api<{ stores: DiscoveryStatus[] }>("catalog/external-prices/discover", {
      method: "POST",
      body: JSON.stringify({ q: query }),
      signal: controller.signal,
    })
      .then(({ stores }) => {
        if (controller.signal.aborted) return;
        setDiscovery(stores);
        if (
          stores.some(
            ({ status }) => status === "queued" || status === "scheduled",
          )
        ) {
          let checks = 0;
          timer = setInterval(() => {
            setAttempt((value) => value + 1);
            if (++checks >= 8) clearInterval(timer);
          }, 15000);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDiscovery([
            { store: "AMAZON", status: "unavailable" },
            { store: "ALMANEA", status: "unavailable" },
            { store: "NOON", status: "unavailable" },
            { store: "EXTRA", status: "unavailable" },
            { store: "TRENDYOL", status: "unavailable" },
          ]);
      });
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [query, productId, discoveryAttempt]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({
      q: query,
      locale,
      page: String(page),
      sort,
      ...(storeFilter ? { store: storeFilter } : {}),
    });
    if (productId) params.set("productId", productId);
    api<Result>(`catalog/external-prices?${params}`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, locale, productId, page, attempt, sort, storeFilter]);
  const pages = result
    ? [
        ...new Set([
          1,
          result.page - 1,
          result.page,
          result.page + 1,
          result.totalPages,
        ]),
      ]
        .filter((number) => number >= 1 && number <= result.totalPages)
        .sort((a, b) => a - b)
    : [];
  return (
    <section
      className="content external-price-results"
      aria-label={ar ? "أسعار المتاجر الخارجية" : "External store prices"}
    >
      <div className="offer-heading">
        <div>
          <span className="offer-eyebrow">
            {ar ? "قارن واختر بثقة" : "A better way to compare"}
          </span>
          <h2>
            {ar ? "اعثر على العرض المناسب لك" : "Find your next great offer"}
          </h2>
          <p>
            {ar ? "عروض من متاجر متعددة لـ" : "Offers across stores for"} “
            {query}”
          </p>
        </div>
        <span className="offer-count">
          {result?.total ?? "—"} {ar ? "عرض" : "offers"}
        </span>
      </div>
      <div className="offer-controls">
        <div
          className="offer-sort"
          role="group"
          aria-label={ar ? "ترتيب العروض" : "Sort offers"}
        >
          {[
            {
              value: "price_asc",
              label: ar ? "أقل سعر" : "Lowest price",
              note: ar ? "قارن الأسعار" : "Compare prices",
            },
            {
              value: "available",
              label: ar ? "المتاح أولاً" : "Available first",
              note: ar ? "ثم الأقل سعراً" : "Then lowest price",
            },
            {
              value: "price_desc",
              label: ar ? "الأعلى سعراً" : "Highest price",
              note: ar ? "من الأعلى للأقل" : "High to low",
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                sort === option.value
                  ? "offer-sort-option selected"
                  : "offer-sort-option"
              }
              aria-pressed={sort === option.value}
              onClick={() => {
                setSort(option.value);
                setPage(1);
              }}
            >
              <strong>{option.label}</strong>
              <small>{option.note}</small>
            </button>
          ))}
          <button
            type="button"
            className="offer-sort-option"
            disabled
            title={
              ar
                ? "لم تُجمع تقييمات المتاجر بعد"
                : "Store review ratings have not been collected"
            }
          >
            <strong>{ar ? "أفضل التقييمات" : "Best reviews"}</strong>
            <small>{ar ? "التقييمات غير متاحة" : "Ratings unavailable"}</small>
          </button>
        </div>
        <label className="offer-store-filter">
          {ar ? "المتجر" : "Store"}
          <select
            value={storeFilter}
            onChange={(e) => {
              setStoreFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{ar ? "كل المتاجر" : "All stores"}</option>
            {(result?.stores || []).map((store) => (
              <option key={store.store} value={store.store}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="offer-disclaimer">
        {ar
          ? "الأسعار حسب آخر فحص. قد تختلف النسخة والسعة والحالة. قارن المنتج المطابق قبل الشراء؛ الشحن والخصومات تُؤكد في المتجر."
          : "Prices from the last successful check. Models, storage and condition may differ. Compare the exact product; confirm shipping and discounts at the store."}
      </p>
      {loading && (
        <p role="status">{ar ? "جارٍ تحميل الأسعار…" : "Loading prices…"}</p>
      )}
      {discovery.length > 0 && (
        <details className="offer-collection">
          <summary>{ar ? "حالة تحديث المتاجر" : "Store update status"}</summary>
          <div role="status" className="muted">
            {discovery.map(({ store, status, retryAt }) => (
              <p key={store}>
                <strong>
                  {(
                    {
                      AMAZON: ar ? "??????" : "Amazon",
                      ALMANEA: ar ? "??????" : "Almanea",
                      NOON: ar ? "???" : "Noon",
                      EXTRA: ar ? "??????" : "eXtra",
                      TRENDYOL: ar ? "????????" : "Trendyol",
                    } as Record<string, string>
                  )[store] || store}
                  :{" "}
                </strong>
                {status === "cooldown" && retryAt
                  ? ar
                    ? `تم إيقاف الجمع مؤقتًا. أعد المحاولة بعد ${new Date(retryAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} (توقيت الرياض).`
                    : `Collection paused. Retry after ${new Date(retryAt).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })} (Riyadh time).`
                  : status === "queued" || status === "scheduled"
                    ? ar
                      ? "تم جدولة البحث. قد تستغرق الأسعار الجديدة بعض الوقت للظهور."
                      : "Search scheduled. New prices may take time to appear."
                    : status === "capacity"
                      ? ar
                        ? "تم الوصول إلى حد البحث الجديد لهذا المتجر. حاول لاحقًا."
                        : "New search collection limit reached. Try again later."
                      : status === "disabled"
                        ? ar
                          ? "تم تعطيل الجمع لهذا البحث من قِبل المسؤول."
                          : "Collection for this search is disabled by the administrator."
                        : status === "robots_disallowed"
                          ? ar
                            ? "??? ?????? ?? ???? ???? ????? ????? ????????. ???? ?? ?????? ?????? ?????."
                            : "This store does not permit automatic search collection. Search the store directly below."
                          : status === "unsupported"
                            ? ar
                              ? "الجمع التلقائي غير متاح حاليًا. ابحث في المتجر مباشرةً أدناه."
                              : "Automatic collection is currently unavailable. Search the store directly below."
                            : ar
                              ? "تعذر جدولة البحث. أعد المحاولة."
                              : "Could not schedule this search. Please retry."}
              </p>
            ))}
            <button
              type="button"
              className="secondary"
              disabled={loading}
              onClick={() => {
                setAttempt((value) => value + 1);
                setDiscoveryAttempt((value) => value + 1);
              }}
            >
              {ar ? "تحديث النتائج" : "Refresh results"}
            </button>
          </div>
        </details>
      )}
      {failed && (
        <p role="alert">
          {ar ? "تعذر تحميل الأسعار." : "Prices could not be loaded."}{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => setAttempt((value) => value + 1)}
            disabled={loading}
          >
            {ar ? "حاول مجددًا" : "Retry"}
          </button>
        </p>
      )}
      {result && (
        <>
          {!result.total ? (
            <p className="empty">
              {ar
                ? "لا توجد أسعار مطابقة محفوظة حاليًا."
                : "No matching monitored prices yet."}
            </p>
          ) : (
            <>
              <div className="travel-offer-list" aria-busy={loading}>
                {result.listings.map((listing, index) => {
                  const name =
                    result.stores.find((store) => store.store === listing.store)
                      ?.name || listing.store;
                  const logo = (
                    {
                      AMAZON: "amazon",
                      ALMANEA: "almanea",
                      NOON: "noon",
                      EXTRA: "extra",
                      TRENDYOL: "trendyol",
                    } as Record<string, string>
                  )[listing.store];
                  const available = ["InStock", "LimitedAvailability"].includes(
                    listing.availability,
                  );
                  const unavailable = [
                    "OutOfStock",
                    "SoldOut",
                    "Discontinued",
                  ].includes(listing.availability);
                  const best =
                    sort === "price_asc" && result.page === 1 && index === 0;
                  return (
                    <article
                      className={
                        best ? "travel-offer best-offer" : "travel-offer"
                      }
                      key={listing.id}
                    >
                      <div className="offer-store-panel">
                        {logo && (
                          <Image
                            unoptimized
                            src={"/stores/" + logo + ".ico"}
                            alt=""
                            width={48}
                            height={48}
                          />
                        )}
                        <strong>{name}</strong>
                        <span>{ar ? "متجر خارجي" : "External store"}</span>
                      </div>
                      <div className="offer-description">
                        <div className="offer-badges">
                          {best && (
                            <span className="offer-badge best">
                              {productId
                                ? ar
                                  ? "أفضل سعر للمنتج المطابق"
                                  : "Best price for this exact product"
                                : ar
                                  ? "أقل سعر في النتائج"
                                  : "Lowest listed price"}
                            </span>
                          )}
                          <span
                            className={
                              available ? "offer-badge in-stock" : "offer-badge"
                            }
                          >
                            {available
                              ? ar
                                ? "متاح حسب آخر فحص"
                                : "Available at last check"
                              : unavailable
                                ? ar
                                  ? "غير متاح حسب آخر فحص"
                                  : "Unavailable at last check"
                                : ar
                                  ? "التوفر غير مؤكد"
                                  : "Availability unconfirmed"}
                          </span>
                        </div>
                        <h3 lang={listing.titleLanguage} dir="auto">
                          {listing.title}
                        </h3>
                        <p className="offer-reviews">
                          <span aria-hidden="true">☆</span>{" "}
                          {ar
                            ? "لم تُجمع التقييمات بعد"
                            : "Reviews not collected"}
                        </p>
                        {!productId && listing.comparisonProductId ? (
                          <Link
                            className="comparison-exact-link"
                            href={
                              "/" +
                              locale +
                              "/compare/" +
                              listing.comparisonProductId
                            }
                          >
                            {ar
                              ? "قارن عروض المنتج المطابق"
                              : "Compare offers for this exact product"}{" "}
                            →
                          </Link>
                        ) : (
                          !listing.comparisonProductId && (
                            <small className="offer-variant-note">
                              {ar
                                ? "تطابق النسخة بين المتاجر غير مؤكد"
                                : "Cross-store variant match not verified"}
                            </small>
                          )
                        )}
                      </div>
                      <div className="offer-booking-panel">
                        <span>{ar ? "السعر المدرج" : "Listed price"}</span>
                        <strong className="offer-amount">
                          {Number(listing.price).toLocaleString(
                            ar ? "ar-SA" : "en-SA",
                            { style: "currency", currency: listing.currency },
                          )}
                        </strong>
                        <small>
                          {ar
                            ? "الشحن والرسوم في المتجر"
                            : "Shipping & fees at store"}
                        </small>
                        <a
                          className="button"
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={
                            (ar ? "عرض الصفقة في " : "View offer at ") +
                            name +
                            ": " +
                            listing.title
                          }
                        >
                          {ar ? "عرض الصفقة" : "View offer"} ↗
                        </a>
                        {listing.lastSeenAt && (
                          <time dateTime={listing.lastSeenAt}>
                            {ar ? "آخر رصد: " : "Last seen: "}
                            {new Date(listing.lastSeenAt).toLocaleDateString(
                              ar ? "ar-SA" : "en-GB",
                              { timeZone: "Asia/Riyadh" },
                            )}
                          </time>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <nav
                className="comparison-pagination"
                aria-label={
                  ar ? "صفحات مقارنة الأسعار" : "Price comparison pages"
                }
              >
                <span role="status">
                  {ar
                    ? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} من ${result.total}`
                    : `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}`}
                </span>
                <button
                  className="secondary"
                  disabled={loading || result.page <= 1}
                  onClick={() => setPage(result.page - 1)}
                >
                  {ar ? "السابق" : "Previous"}
                </button>
                {pages.map((number, index) => (
                  <span key={number}>
                    {index > 0 && number - pages[index - 1] > 1 && (
                      <span aria-hidden="true"> … </span>
                    )}
                    <button
                      className={number === result.page ? "" : "secondary"}
                      aria-current={number === result.page ? "page" : undefined}
                      aria-label={`${ar ? "الصفحة" : "Page"} ${number}`}
                      disabled={loading}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </button>
                  </span>
                ))}
                <button
                  className="secondary"
                  disabled={loading || result.page >= result.totalPages}
                  onClick={() => setPage(result.page + 1)}
                >
                  {ar ? "التالي" : "Next"}
                </button>
              </nav>
            </>
          )}
          <details className="comparison-more-stores">
            <summary>
              {ar ? "ابحث في المتاجر مباشرة" : "Search stores directly"}
            </summary>
            <div>
              {result.stores.map((store) => (
                <a
                  key={store.store}
                  href={store.searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {store.name} ↗
                </a>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
