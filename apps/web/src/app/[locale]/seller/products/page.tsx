import { SellerDashboard } from "@/components/seller-dashboard";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <SellerDashboard locale={(await params).locale} />;
}
