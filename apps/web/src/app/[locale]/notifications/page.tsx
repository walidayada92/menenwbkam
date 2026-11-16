import { Notifications } from "@/components/notifications";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <Notifications locale={(await params).locale} />;
}
