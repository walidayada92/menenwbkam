import { CartPage } from "@/components/cart";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <CartPage locale={(await params).locale} />;
}
