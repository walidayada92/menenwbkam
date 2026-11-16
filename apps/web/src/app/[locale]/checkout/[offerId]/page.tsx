import { Checkout } from "@/components/checkout";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; offerId: string }>;
}) {
  const { locale, offerId } = await params;
  return <Checkout locale={locale} offerId={offerId} />;
}
