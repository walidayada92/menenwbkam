import { SellerInsights } from "@/components/seller-insights";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <SellerInsights locale={(await params).locale} />;
}
