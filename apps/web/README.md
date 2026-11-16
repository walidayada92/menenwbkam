# Marketplace web

See [the root README](../../README.md) for setup and verification.

Routes are localized under /ar (default, RTL) and /en. Shopper pages render catalog data on the server; seller/admin dashboards use protected API requests. /api is a server-side proxy to API_URL. Login stores the token in an HttpOnly, SameSite=Lax cookie (Secure in production); it never returns the token to browser JavaScript.

The CSV template is public at /import-template.csv. Browser image loading uses seller-supplied HTTPS URLs. All dashboard labels have Arabic and English translations.
