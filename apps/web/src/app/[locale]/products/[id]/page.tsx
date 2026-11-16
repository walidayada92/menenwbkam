import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/api";
import { ProductDetail } from "@/lib/types";
import { words, money } from "@/lib/words";
import { Reviews } from "@/components/reviews";
import { Engagement, OfferLink } from "@/components/engagement";
import { SaveProduct } from "@/components/saved-shopping";
import { PriceTracker } from "@/components/price-tracker";
import { AddToCart } from "@/components/cart";
import { ExternalPriceResults } from "@/components/external-price-results";
export default async function Detail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = words(locale);
  let product: ProductDetail;
  try {
    product = await catalog<ProductDetail>(
      "products/" + encodeURIComponent(id),
    );
  } catch {
    notFound();
  }
  return (
    <section className="content">
      <Engagement offerIds={product.offers.map((o) => o.id)} />
      <Link href={`/${locale}`}>← {t.back}</Link>
      <div className="detail-header">
        <div className="product-image">
          {product.images?.[0] ? (
            <Image
              unoptimized
              src={product.images[0]}
              alt={product.modelName}
              width={400}
              height={300}
            />
          ) : (
            <span>◇</span>
          )}
        </div>
        <div>
          <div className="eyebrow">
            {locale === "ar" ? product.brand.nameAr : product.brand.nameEn}
          </div>
          <h1>{product.modelName}</h1>
          <p>
            {locale === "ar" ? product.descriptionAr : product.descriptionEn}
          </p>
          <strong className="price">
            {money(product.offers[0].price, locale)}
          </strong>
          <p>{t.delivery}</p>
          <SaveProduct locale={locale} productId={product.id} />
        </div>
      </div>
      <PriceTracker
        locale={locale}
        productId={product.id}
        bestPrice={product.offers[0].price}
      />
      <ExternalPriceResults
        locale={locale}
        query={product.modelName.slice(0, 100)}
      />
      <h2>{t.compare}</h2>
      <div className="offer-list">
        {product.offers.map((o, i) => (
          <article className="offer-row" key={o.id}>
            <div>
              <h3>
                {o.seller.slug ? (
                  <Link href={`/${locale}/stores/${o.seller.slug}`}>
                    {o.seller.businessName} ↗
                  </Link>
                ) : (
                  o.seller.businessName
                )}
              </h3>
              {o.isFeatured && (
                <span className="badge">
                  {locale === "ar" ? "تاجر مميز" : "Featured seller"}
                </span>
              )}
              <span>
                {Number(o.seller.rating) > 0
                  ? Number(o.seller.rating) + " ★"
                  : "—"}{" "}
                · {t.available}
              </span>
            </div>
            {i === 0 && <span className="badge">{t.best}</span>}
            <strong className="price">{money(o.price, locale)}</strong>
            <AddToCart locale={locale} offerId={o.id} />
            <SaveProduct
              locale={locale}
              productId={product.id}
              offerId={o.id}
            />
            <OfferLink offerId={o.id} href={`/${locale}/checkout/${o.id}`}>
              {locale === "ar"
                ? "اطلب من هذا التاجر"
                : "Order from this seller"}
            </OfferLink>
            {o.productUrl ? (
              <OfferLink
                offerId={o.id}
                external
                className="button"
                href={o.productUrl}
              >
                {t.visit} ↗
              </OfferLink>
            ) : (
              <span>{t.noLink}</span>
            )}
          </article>
        ))}
      </div>
      <Reviews
        locale={locale}
        productId={id}
        sellers={product.offers.map((o) => o.seller)}
      />
    </section>
  );
}
