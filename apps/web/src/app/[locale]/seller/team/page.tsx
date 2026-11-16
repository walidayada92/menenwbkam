import { SellerTeam } from "@/components/seller-team";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <SellerTeam locale={(await params).locale} />;
}
