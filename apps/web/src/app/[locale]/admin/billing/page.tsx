import { AdminBilling } from "@/components/admin-billing";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <AdminBilling locale={(await params).locale} />;
}
