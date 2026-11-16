import { SellerBilling } from "@/components/seller-billing";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <SellerBilling locale={(await params).locale} />;
}
