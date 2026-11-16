import { OrdersList } from "@/components/orders-list";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <OrdersList locale={(await params).locale} seller />;
}
