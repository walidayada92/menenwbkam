import { AdminDashboard } from "@/components/admin-dashboard";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <AdminDashboard locale={(await params).locale} />;
}
