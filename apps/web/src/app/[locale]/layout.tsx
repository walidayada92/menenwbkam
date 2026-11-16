import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { ShoppingAccessProvider } from "@/components/shopping-access";
import "../globals.css";
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
          <header className="site-header">
            <Link className="logo" href={`/${locale}`}>
              {ar ? "منين وبكام" : "Menenwbkam"}
              <span>●</span>
            </Link>
            <MainNav locale={locale} />
          </header>
          <main>
            <ShoppingAccessProvider locale={locale}>
              {children}
            </ShoppingAccessProvider>
          </main>
          <footer>
            {ar
              ? "قارن بثقة. التوصيل وتنفيذ الطلبات مسؤولية كل تاجر."
              : "Compare with confidence. Each seller handles fulfillment and delivery."}
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
