"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LanguageSwitch({ locale }: { locale: string }) {
  const path = usePathname();
  const params = useSearchParams().toString();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <Link
      href={
        path.replace(/^\/(ar|en)(?=\/|$)/, "/" + other) +
        (params ? "?" + params : "")
      }
      lang={other}
    >
      {other === "en" ? "English" : "العربية"}
    </Link>
  );
}
export function ComparisonNav({ locale }: { locale: string }) {
  const ar = locale === "ar";
  return (
    <nav aria-label={ar ? "القائمة الرئيسية" : "Main navigation"}>
      <Link href={"/" + locale}>{ar ? "قارن الأسعار" : "Compare prices"}</Link>
      <Link href={"/" + locale + "/about"}>
        {ar ? "عن منين وبكام" : "About us"}
      </Link>
      <Suspense
        fallback={
          <Link href={"/" + (ar ? "en" : "ar")}>
            {ar ? "English" : "العربية"}
          </Link>
        }
      >
        <LanguageSwitch locale={locale} />
      </Suspense>
    </nav>
  );
}
