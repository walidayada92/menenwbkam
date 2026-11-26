import Link from "next/link";
import type { Metadata } from "next";
import { SearchForm } from "@/components/search-form";
import { ExternalPriceResults } from "@/components/external-price-results";
import { siteUrl } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const q = (await searchParams).q;
  return {
    title:
      locale === "ar"
        ? "منين وبكام | قارن أسعار المتاجر"
        : "Menenwbkam | Compare store prices",
    description:
      locale === "ar"
        ? "ابحث وقارن أسعار المنتجات في المتاجر السعودية. شاهد السعر والتوفر وتاريخ الرصد، ثم أكمل الشراء في المتجر."
        : "Compare product prices across Saudi stores. Check availability and price dates, then buy directly from the store.",
    alternates: {
      canonical: "/" + locale,
      languages: { ar: "/ar", en: "/en" },
    },
    robots: q ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function ComparisonHome({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const query = typeof raw.q === "string" ? raw.q.trim().slice(0, 100) : "";
  const ar = locale === "ar";
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Menenwbkam — منين وبكام",
    url: siteUrl().origin,
    inLanguage: ["ar", "en"],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <section className="market-hero">
        <div className="market-hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" />
              {ar ? "قارن قبل ما تشتري" : "Compare before you buy"}
            </div>
            <h1>
              {ar
                ? "منين تشتري؟ وبكام؟"
                : "Find it. Compare it. Choose confidently."}
            </h1>
            <p>
              {ar
                ? "أسعار المتاجر في مكان واحد. ابحث عن المنتج، قارن العروض، وأكمل الشراء مباشرة في المتجر."
                : "Store prices in one place. Find your product, compare offers, and complete your purchase directly at the store."}
            </p>
          </div>
          <div className="hero-price-card" aria-hidden="true">
            <span>{ar ? "قارن الأسعار" : "Compare store prices"}</span>
            <strong>SAR</strong>
            <div className="signal-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <small>
              {ar
                ? "اختيار أوضح بدون تسجيل"
                : "A clearer choice. No signup needed."}
            </small>
          </div>
          <SearchForm locale={locale} query={{ q: query }} />
          <div className="hero-promises">
            <span>{ar ? "بدون تسجيل حساب" : "No account required"}</span>
            <span>
              {ar ? "مقارنة بالريال السعودي" : "Prices in Saudi riyals"}
            </span>
            <span>
              {ar ? "الشراء من المتجر مباشرة" : "Buy directly from the store"}
            </span>
          </div>
        </div>
      </section>
      {query.length >= 2 ? (
        <ExternalPriceResults locale={locale} query={query} />
      ) : (
        <section className="content comparison-intro">
          {query && (
            <p role="status">
              {ar
                ? "اكتب حرفين على الأقل للبحث."
                : "Enter at least two characters to search."}
            </p>
          )}
          <div className="section-heading">
            <h2>{ar ? "ابدأ المقارنة" : "Start comparing"}</h2>
          </div>
          <div className="category-chips">
            {[
              { q: "iphone 17", ar: "آيفون 17", en: "iPhone 17" },
              { q: "tv", ar: "تلفزيونات", en: "Televisions" },
              { q: "laptop", ar: "لابتوب", en: "Laptops" },
              { q: "headphones", ar: "سماعات", en: "Headphones" },
            ].map((item) => (
              <Link
                key={item.q}
                href={"/" + locale + "?q=" + encodeURIComponent(item.q)}
              >
                {ar ? item.ar : item.en} ↗
              </Link>
            ))}
          </div>
          <div className="comparison-story">
            <div className="story-lede">
              <h2>
                {ar
                  ? "اعرف السعر قبل القرار."
                  : "A better-informed purchase starts here."}
              </h2>
              <p>
                {ar
                  ? "منين وبكام خدمة لمقارنة الأسعار، وليس متجرًا. لا نستقبل طلبات أو مدفوعات."
                  : "Menenwbkam is a price-comparison service. We do not sell products, take orders, or collect payments."}
              </p>
            </div>
            <div className="story-steps">
              {[
                { n: "01", ar: "ابحث عن المنتج", en: "Find your product" },
                {
                  n: "02",
                  ar: "قارن النسخة والسعر",
                  en: "Compare model and price",
                },
                {
                  n: "03",
                  ar: "انتقل للمتجر للشراء",
                  en: "Visit the store to buy",
                },
              ].map((step) => (
                <article key={step.n}>
                  <b>{step.n}</b>
                  <h3>{ar ? step.ar : step.en}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
