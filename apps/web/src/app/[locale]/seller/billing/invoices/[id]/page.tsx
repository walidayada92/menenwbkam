import { BillingInvoice } from "@/components/billing-invoice";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <BillingInvoice locale={locale} id={id} />;
}
