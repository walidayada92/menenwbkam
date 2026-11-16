import { Account } from "@/components/account";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <Account locale={(await params).locale} />;
}
