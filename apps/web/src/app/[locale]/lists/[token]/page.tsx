import { notFound } from "next/navigation";
import { catalog } from "@/lib/api";
import { SharedList } from "@/components/saved-shopping";
export default async function SharedListPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  try {
    return (
      <SharedList
        locale={locale}
        list={await catalog(`shared-lists/${token}`)}
      />
    );
  } catch {
    notFound();
  }
}
