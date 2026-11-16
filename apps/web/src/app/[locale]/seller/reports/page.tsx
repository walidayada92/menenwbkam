import { SellerOverview } from "@/components/seller-overview";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <SellerOverview locale={(await params).locale} report />;
}
