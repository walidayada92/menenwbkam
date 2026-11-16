import { CartCheckout } from "@/components/cart-checkout";

export default async function CartCheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <CartCheckout locale={(await params).locale} />;
}
