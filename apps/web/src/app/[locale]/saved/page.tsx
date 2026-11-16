import { SavedShopping } from "@/components/saved-shopping";
export default async function SavedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <SavedShopping locale={(await params).locale} />;
}
