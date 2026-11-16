export function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be an origin such as https://your-domain.com",
    );
  return url;
}
