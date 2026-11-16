import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["ar", "en"].flatMap((locale) =>
    ["", "/about", "/privacy", "/terms"].map((path) => ({
      url: siteUrl().origin + "/" + locale + path,
      alternates: {
        languages: {
          ar: siteUrl().origin + "/ar" + path,
          en: siteUrl().origin + "/en" + path,
        },
      },
    })),
  );
}
