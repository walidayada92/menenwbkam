import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/api";
import { ExternalPriceResults } from "@/components/external-price-results";
export default async function ExactComparison({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  let product: {
    id: string;
    title: string;
    attributes: Record<string, string | number>;
  };
  try {
    product = await catalog(`comparison-products/${encodeURIComponent(id)}`);
  } catch {
    notFound();
  }
  const ar = locale === "ar";
  return (
    <section className="content">
      <Link href={`/${locale}`}>{ar ? "العودة للبحث" : "Back to search"}</Link>
      <h1>{ar ? "مقارنة المنتج المطابق" : "Exact product comparison"}</h1>
      <p>
        {ar
          ? "هذه العروض مرتبطة بنفس هوية المنتج وحالته. تحقق من الشحن والضمان في المتجر."
          : "These offers share the same product identity and condition. Check shipping and warranty at the store."}
      </p>
      <ExternalPriceResults
        locale={locale}
        query={product.title.slice(0, 100)}
        productId={product.id}
      />
    </section>
  );
}
