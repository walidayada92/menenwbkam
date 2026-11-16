import { NextRequest } from "next/server";
import { locales } from "../i18n";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const pathnameIsMissingLocale = locales.every(
    (locale) =>
      !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`,
  );

  if (pathnameIsMissingLocale) {
    const locale = "ar";
    request.nextUrl.pathname = `/${locale}${pathname}`;
    return Response.redirect(request.nextUrl.toString());
  }
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
