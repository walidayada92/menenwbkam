import Link from "next/link";
import Image from "next/image";
import { catalog } from "@/lib/api";
import { words, money } from "@/lib/words";
import { Taxonomy, SearchResults } from "@/lib/types";
import { SearchForm } from "@/components/search-form";
import { WishlistHeart } from "@/components/saved-shopping";
import { AddToCart } from "@/components/cart";
import { ExternalPriceResults } from "@/components/external-price-results";
export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const raw = await searchParams;
  const query: Record<string, string> = {};
  for (const key of [
    "q",
    "brandId",
    "categoryId",
    "minPrice",
    "maxPrice",
    "minRating",
    "sort",
    "page",
  ])
    if (typeof raw[key] === "string" && raw[key])
      query[key] = raw[key] as string;
  const t = words(locale);
  let taxonomy: Taxonomy = { brands: [], categories: [] },
    results: SearchResults = { items: [], total: 0, page: 1, pageSize: 24 },
    failed = false;
  let intent = {
    query: query.q || "",
    sort: null as string | null,
    interpreted: false,
  };
  try {
    if (query.q?.trim()) {
      intent = await catalog<typeof intent>(
        "search-intent?" + new URLSearchParams({ q: query.q }),
      );
      if (intent.sort && !query.sort) query.sort = intent.sort;
    }
    [taxonomy, results] = await Promise.all([
      catalog<Taxonomy>("taxonomy"),
      intent.interpreted && !intent.query
        ? Promise.resolve(results)
        : catalog<SearchResults>(
            "products?" +
              new URLSearchParams({
                ...query,
                ...(query.q ? { q: intent.query } : {}),
              }),
          ),
    ]);
  } catch {
    failed = true;
  }
  const pageLink = (page: number) =>
    `/${locale}?` + new URLSearchParams({ ...query, page: String(page) });
  const ar = locale === "ar";
  const categoryLabel = (category: Taxonomy["categories"][number]) =>
    ar ? category.nameAr : category.nameEn;
  return (
    <>
      <section className="market-hero">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="market-hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" />{" "}
              {ar ? "تسوق بقرار أوضح" : "Shop with a clearer decision"}
            </div>
            <h1>
              {ar
                ? "اعرف السعر. اختر بثقة."
                : "Know the price. Choose with confidence."}
            </h1>
            <p>
              {ar
                ? "ابحث عن المنتج نفسه، وشاهد عروض التجار المتاحة في مكان واحد قبل أن تطلب."
                : "Search for the same product and see available seller offers together before you order."}
            </p>
          </div>
          <div className="hero-price-card" aria-hidden="true">
            <span>{ar ? "مؤشر السعر" : "Price signal"}</span>
            <strong>SAR</strong>
            <div className="signal-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <small>{ar ? "قارن قبل الشراء" : "Compare before buying"}</small>
          </div>
          <SearchForm locale={locale} taxonomy={taxonomy} query={query} />
          <div className="hero-promises">
            <span>⌕ {ar ? "بحث سريع" : "Fast search"}</span>
            <span>↗ {ar ? "عروض تجار متعددة" : "Multiple seller offers"}</span>
            <span>♡ {ar ? "احفظ للمقارنة لاحقًا" : "Save for later"}</span>
          </div>
        </div>
      </section>
      {!Object.keys(query).length && taxonomy.categories.length > 0 && (
        <section className="category-rail content">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {ar ? "ابدأ من هنا" : "Start exploring"}
              </span>
              <h2>{ar ? "تسوق حسب الفئة" : "Shop by category"}</h2>
            </div>
          </div>
          <div className="category-chips">
            {taxonomy.categories.slice(0, 8).map((category, index) => (
              <Link
                key={category.id}
                href={`/${locale}?categoryId=${encodeURIComponent(category.id)}`}
              >
                <span className={`category-mark mark-${index % 4}`}>
                  {["◌", "◇", "⌁", "✦"][index % 4]}
                </span>
                {categoryLabel(category)}
                <small>↗</small>
              </Link>
            ))}
          </div>
        </section>
      )}
      {intent.interpreted && (
        <p className="content muted" role="status">
          {intent.query
            ? ar
              ? `نبحث عن «${intent.query}». الأسعار المحفوظة مرتبة من الأقل للأعلى.`
              : `Searching for “${intent.query}”. Saved prices are sorted lowest first.`
            : ar
              ? "اكتب اسم المنتج، مثل: أرخص آيفون 17."
              : "Include a product name, for example: the lowest iPhone 17 price."}
        </p>
      )}
      {intent.query.trim().length >= 2 && (
        <ExternalPriceResults
          locale={locale}
          query={intent.query.trim().slice(0, 100)}
        />
      )}
      <section className="results">
        <div className="section-heading">
          <h2>
            {results.total} {t.results}
          </h2>
          <span>
            SAR · {locale === "ar" ? "تجار معتمدون" : "Approved sellers"}
          </span>
        </div>
        {failed ? (
          <p className="notice" role="alert">
            {t.unavailable}
          </p>
        ) : !results.items.length ? (
          <p className="empty">{t.empty}</p>
        ) : (
          <div className="product-grid">
            {results.items.map((p) => (
              <article className="product-card" key={p.id}>
                <WishlistHeart locale={locale} productId={p.id} />
                <AddToCart locale={locale} offerId={p.bestOfferId} />
                <Link href={`/${locale}/products/${p.id}`}>
                  <div className="product-image">
                    {p.images?.[0] ? (
                      <Image
                        unoptimized
                        src={p.images[0]}
                        alt={p.modelName}
                        width={300}
                        height={200}
                      />
                    ) : (
                      <span aria-hidden="true">◇</span>
                    )}
                  </div>
                  <small>
                    {locale === "ar" ? p.brand.nameAr : p.brand.nameEn}
                  </small>
                  <h3>{p.modelName}</h3>
                  <div className="price">
                    <small>{t.from}</small> {money(p.bestPrice, locale)}
                  </div>
                  <div className="card-bottom">
                    <span>
                      {p.offerCount} {t.sellers}
                    </span>
                    <strong>{t.compare} ↗</strong>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
        <nav className="pagination" aria-label="Pagination">
          {results.page > 1 && (
            <Link
              className="button secondary"
              href={pageLink(results.page - 1)}
            >
              {t.previous}
            </Link>
          )}
          {results.page * 24 < results.total && (
            <Link className="button" href={pageLink(results.page + 1)}>
              {t.next}
            </Link>
          )}
        </nav>
      </section>
      {!Object.keys(query).length && (
        <section className="comparison-story content">
          <div className="story-lede">
            <span className="eyebrow">{ar ? "كيف تعمل" : "How it works"}</span>
            <h2>
              {ar
                ? "من البحث إلى أفضل عرض في ثلاث خطوات."
                : "From search to the right offer in three steps."}
            </h2>
          </div>
          <div className="story-steps">
            <article>
              <b>01</b>
              <h3>{ar ? "ابحث" : "Search"}</h3>
              <p>
                {ar
                  ? "اكتب اسم المنتج أو العلامة التجارية."
                  : "Enter a product or brand name."}
              </p>
            </article>
            <article>
              <b>02</b>
              <h3>{ar ? "قارن" : "Compare"}</h3>
              <p>
                {ar
                  ? "شاهد السعر والتاجر والتوفر في صفحة واحدة."
                  : "See price, seller, and availability together."}
              </p>
            </article>
            <article>
              <b>03</b>
              <h3>{ar ? "اختر" : "Choose"}</h3>
              <p>
                {ar
                  ? "اطلب من التاجر الذي يناسبك."
                  : "Order from the seller that suits you."}
              </p>
            </article>
          </div>
        </section>
      )}
    </>
  );
}
