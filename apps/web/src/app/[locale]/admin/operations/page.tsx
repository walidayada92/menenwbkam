import { AdminOperations } from "@/components/admin-operations";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <AdminOperations locale={(await params).locale} />;
}
