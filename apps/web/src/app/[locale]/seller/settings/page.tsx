import { SellerSettings } from "@/components/seller-settings";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <SellerSettings locale={(await params).locale} />;
}
