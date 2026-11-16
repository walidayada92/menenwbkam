# External product monitoring (connectors)

For the complete scheduled discovery, durable queue, separate worker, matcher, and
search-index flow, see [comparison pipeline](comparison-pipeline.md). This page
describes the store connectors and diagnostic import scripts.

This background worker monitors public product pages on Amazon Saudi Arabia,
Noon, and Almanea. Almanea uses Product/Offer JSON-LD; Amazon uses a dedicated
HTML adapter scoped to its main product price and availability. Noon uses a
dedicated adapter that reads Product JSON-LD when present, with a fallback to
an explicitly validated `__NEXT_DATA__` fixture format; its live presence is unverified. All three have been
verified against their parsing logic in unit tests. Live verification against
Noon's production hosts depends on robots.txt permitting access and the page
returning structured data; if Noon's hosts time out or return an access
challenge, the run is recorded as failed and retried at the next interval.
HTTP mode requires robots.txt access. Explicit direct-browser mode is described
in the comparison pipeline guide. Neither mode solves access challenges.
JavaScript-only pages, login walls, CAPTCHA, missing prices, unsafe redirects,
and ambiguous prices fail visibly in run history. These are public-page
adapters, not proprietary API integrations.

## Setup

From the repository root:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
```

These migrations add separate monitoring tables. They do not create marketplace
offers or modify seller stock. Run migrations against the intended database before
enabling the worker. Set `EXTERNAL_SYNC_ENABLED=true` in the API environment and
restart the API to enable the scheduler. Keep the API running; the scheduler is
not a hosted cron service. Source definitions and due times persist in PostgreSQL.
The process polls every minute; each source defaults to a six-hour interval (minimum
one hour). Sources start disabled. Manual sync can be queued with the scheduler disabled; a worker must be running.

Use an administrator session through `/api/admin/external-sources` on the web app
or a bearer token with `/admin/external-sources` on the API. Swagger is at
`/api/docs` on the API server. Example source payload for `POST`:

```json
{
  "name": "Almanea monitored appliances",
  "store": "ALMANEA",
  "productUrls": ["https://www.almanea.sa/REPLACE-WITH-REAL-PRODUCT-URL"],
  "sitemapUrls": [],
  "intervalMinutes": 360
}
```

Supported `store` values: `AMAZON`, `NOON`, `ALMANEA`. Configure real canonical
URLs; the example URL above is a placeholder, not a working product.

| Endpoint                                   | Purpose                                    |
| ------------------------------------------ | ------------------------------------------ |
| `GET /admin/external-sources`              | List configured sources and next run/error |
| `POST /admin/external-sources`             | Create a disabled source                   |
| `PUT /admin/external-sources/:id/enabled`  | Body: `{"enabled":true}` or false          |
| `POST /admin/external-sources/:id/sync`    | Run now; returns run result                |
| `GET /admin/external-sources/:id/runs`     | Latest 50 run results/errors               |
| `GET /admin/external-sources/:id/listings` | Listings with latest 10 changes each       |

Sync endpoints return a queued job immediately. The separate worker processes it
and records a run result; inspect job and run history for completion.

## Discovery and changes

To follow Amazon's iPhone search pagination through the final results page:

```powershell
npm.cmd run build --workspace=api
node scripts/import-amazon-iphones.cjs
```

The importer follows the enabled Next link until the final page, validates that
each page advances within the same search, deduplicates ASINs across all pages,
filters common accessories, reuses stored source URLs, and splits newly discovered
URLs into 25-product batches. Pagination loops, challenges, empty unexpected pages,
and a 100-page safety limit produce an explicit failure, not a complete-coverage
claim. The import logs page counts, unique devices, and verified-price counts.
It covers that search's results, not Amazon's entire catalog. Each product is checked independently; missing
or ambiguous main prices are reported, never replaced with search snippets,
installment amounts, or crossed-out list prices. Exact stock counts remain unknown.

To discover and import current iPhone listings from Almanea's public iPhone
category, build the API and run the importer from the repository root:

```powershell
npm.cmd run build --workspace=api
node scripts/import-almanea-iphones.cjs
```

The importer honors the same robots and request-rate checks as the worker,
deduplicates product URLs, follows category page links, reuses existing sources,
and splits new URLs into batches of at most 25. It prints discovery, sync errors,
and imported counts. Rerun it to discover newly listed category products. Enabled
sources are rechecked by the scheduler when `EXTERNAL_SYNC_ENABLED=true`; category
discovery itself runs when this command is invoked.

The storefront's **Compare prices** search displays matching monitored external
listings alongside local catalog results. Product comparison pages also display
external matches by model name. `GET /catalog/external-prices?q=iPhone%2016` is
public and read-only; searches never start a crawl. Add `locale=en|ar` and `page=1`
to select display language and a 20-row page. The storefront uses one table sorted
by SAR price across stores, with official store icons and numbered pagination.
Listings store real `titleEn`/`titleAr` and `urlEn`/`urlAr` from each store's
language-specific pages. Amazon uses its normal `lc-acbsa` language preference;
Almanea uses its `/en/product/` route. Titles are never generated or translated.
Both pages must identify the same ASIN/SKU. If a localized page fails, the existing
price and any previously collected title remain intact. The UI shows the source
title with a language-unavailable note until the requested title is collected;
there is no "Original store title" expander. Run `node scripts/sync-store-languages.cjs`
after building the API to backfill missing English titles without changing prices.
English model, capacity and common color/condition
search terms also match their Arabic source equivalents. Results show last observation
time and availability, and link to each store. Empty stores show search links
(Almanea discovery uses a Google site search), not invented prices. Title matches
are candidates: storage, condition, region, and variants still require checking.
No source data appears until a source has been configured and successfully synced.

- Direct product URLs track only those products. They cannot discover a whole store.
- Optional **leaf product sitemaps** (`urlset`, not `sitemapindex`) discover new
  URLs on subsequent runs. Configure only product sitemaps, not category/blog URLs.
- Pilot limit: 25 total discovered/tracked URLs per source, three leaf sitemaps.
  Larger sets fail before changing listings; split the scope into smaller sources.
  Full-store crawling, sitemap-index traversal, and pagination are future work.
- Changes: `ADDED`, `PRICE_CHANGED`, `STOCK_CHANGED`, `DETAILS_CHANGED`,
  `REMOVED`, `RESTORED`, with before/after values and timestamps.
- “ADDED” means first observed by this monitor, not proof of the store's launch date.
- Stock quantity stays null unless explicitly published. InStock is availability,
  not a guessed quantity. Observations are snapshots, not inventory reservations.
- Only two explicit HTTP 404/410 checks mark an existing listing removed. A URL
  absent from a sitemap remains tracked. A timeout, parse failure, or blocked
  request never implies removal and preserves the previous snapshot.
- A reappearing removed product produces `RESTORED`. Nothing is hard-deleted.
- Failed pages produce partial/failed runs and are retried on the next interval.
  HTTP 403/429 stops the run; the worker does not retry rapidly or evade blocking.

## Operational limits

Requests use HTTPS store-domain allowlists, public DNS checks, at most three
same-store redirects (with robots/DNS checks at every destination),
15-second fetch timeouts, a 4 MB response cap, a minimum two-second request gap,
and robots.txt allow/disallow checks. Advertised crawl delays are honored
conservatively. Unknown robots policy fails closed. The worker stops after four
minutes. Database leases and transactional owner checks prevent concurrent source
writes across API processes; abandoned leases expire after ten minutes. An
interrupted run is marked when the next worker claims that source.

This is a monitoring backend, not automatic publication. Matching external products
to the local catalog, an admin review UI, production crawl queues, and retailer-
specific authorized APIs/feeds remain separate work. Amazon/Noon pages may not
provide the public structured data required by this pilot. Official access should
replace public extraction where needed:

- [Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction)
- [Noon partner API documentation](https://noon-docs.noonpartners.dev/)

Tests: `npm.cmd test --workspace=api -- --run src/external-sync`.
