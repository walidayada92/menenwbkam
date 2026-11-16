import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/api";
import { money } from "@/lib/words";
import { Reviews } from "@/components/reviews";
import { Engagement, OfferLink } from "@/components/engagement";
import { WishlistHeart } from "@/components/saved-shopping";
import { AddToCart } from "@/components/cart";
interface Store {
  id: string;
  businessName: string;
  description: string | null;
  logo: string | null;
  bannerUrl: string | null;
  brandColor: string;
  rating: string;
  offers: {
    id: string;
    title: string;
    price: string;
    images: string[];
    productId: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params,
    { page } = await searchParams;
  let store: Store | null;
  try {
    store = await catalog<Store>(
      "stores/" +
        encodeURIComponent(slug) +
        "?page=" +
        encodeURIComponent(page || "1"),
    );
  } catch {
    notFound();
  }
  if (!store) notFound();
  return (
    <section className="storefront content">
      <div className="store-cover" style={{ background: store.brandColor }}>
        {store.bannerUrl && (
          <Image
            unoptimized
            src={store.bannerUrl}
            alt=""
            width={1200}
            height={260}
          />
        )}
      </div>
      <div className="store-identity">
        {store.logo ? (
          <Image
            unoptimized
            src={store.logo}
            alt={store.businessName}
            width={90}
            height={90}
          />
        ) : (
          <div className="store-monogram" style={{ color: store.brandColor }}>
            {store.businessName.slice(0, 1)}
          </div>
        )}
        <div>
          <span className="badge">
            {locale === "ar" ? "تاجر معتمد" : "Approved seller"}
          </span>
          <h1>{store.businessName}</h1>
          <p>{store.description}</p>
          <span>{Number(store.rating) > 0 ? store.rating + " ★" : "—"}</span>
        </div>
      </div>
      <Engagement offerIds={store.offers.map((o) => o.id)} />
      <div className="section-heading">
        <h2>{locale === "ar" ? "منتجات المتجر" : "Store products"}</h2>
        <span>{store.total}</span>
      </div>
      <div className="product-grid">
        {store.offers.map((o) => (
          <article className="product-card" key={o.id}>
            <WishlistHeart locale={locale} productId={o.productId} />
            <AddToCart locale={locale} offerId={o.id} />
            <Link href={`/${locale}/products/${o.productId}`}>
              <div className="product-image">
                {o.images[0] ? (
                  <Image
                    unoptimized
                    src={o.images[0]}
                    alt={o.title}
                    width={260}
                    height={180}
                  />
                ) : (
                  <span>◇</span>
                )}
              </div>
              <h3>{o.title}</h3>
            </Link>
            <p className="price">{money(o.price, locale)}</p>
            <OfferLink offerId={o.id} href={`/${locale}/checkout/${o.id}`}>
              {locale === "ar" ? "اطلب الآن" : "Place order"}
            </OfferLink>
          </article>
        ))}
      </div>
      <nav className="pagination">
        {store.page > 1 && (
          <Link className="button secondary" href={`?page=${store.page - 1}`}>
            ←
          </Link>
        )}
        {store.page * store.pageSize < store.total && (
          <Link className="button" href={`?page=${store.page + 1}`}>
            →
          </Link>
        )}
      </nav>
      <Reviews
        locale={locale}
        sellers={[{ id: store.id, businessName: store.businessName }]}
      />
    </section>
  );
}
