import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { ComparisonNav } from "@/components/comparison-nav";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import "../globals.css";
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  applicationName: "Menenwbkam",
  title: { default: "Menenwbkam", template: "%s | Menenwbkam" },
};
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!["ar", "en"].includes(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const ar = locale === "ar";
  return (
    <html lang={locale} dir={ar ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <a className="skip-link" href="#main-content">
            {ar ? "انتقل للمحتوى" : "Skip to content"}
          </a>
          <header className="site-header">
            <Link className="logo" href={`/${locale}`}>
              {ar ? "منين وبكام" : "Menenwbkam"}
              <span>●</span>
            </Link>
            <ComparisonNav locale={locale} />
          </header>
          <main id="main-content">{children}</main>
          <footer>
            {ar
              ? "منين وبكام لمقارنة الأسعار. الشراء والدفع والتوصيل من خلال المتجر مباشرة."
              : "Menenwbkam compares prices. Purchases, payments and delivery are handled directly by the store."}
            <div className="footer-links">
              <Link href={"/" + locale + "/about"}>
                {ar ? "عن الموقع" : "About"}
              </Link>
              <Link href={"/" + locale + "/privacy"}>
                {ar ? "الخصوصية" : "Privacy"}
              </Link>
              <Link href={"/" + locale + "/terms"}>
                {ar
                  ? "طريقة المقارنة وشروط الاستخدام"
                  : "How we compare & terms"}
              </Link>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
