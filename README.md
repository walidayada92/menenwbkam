# Menenwbkam — منين وبكام

Arabic-first price comparison marketplace. Sellers own their listings and handle payment, fulfillment and delivery. Shoppers can submit an order to a seller or visit the seller's external purchase link. Subscription billing currently runs in test mode.

## Local setup (Windows / PowerShell)

Requires Node.js 24, npm, and Docker Desktop running Linux containers (or an existing PostgreSQL 16+ database).

1. Run `Copy-Item .env.example .env`.
2. Edit `.env`: set your database password, matching `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, and optional admin email/password. Use at least 12 characters for the admin password. URL-encode special characters in database passwords.
3. Run:

```powershell
npm.cmd ci
docker compose up -d postgres
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Shopper site: http://localhost:3001/ar (English: /en). API: http://localhost:3000. OpenAPI: http://localhost:3000/api/docs.

The API dev script loads the root `.env`. Next.js loads root settings from `next.config.ts`; API_URL defaults to localhost:3000. Credentials stay outside source control. The seed adds a free plan and initial taxonomy, with no fabricated offers. It creates an admin only when ADMIN_EMAIL and ADMIN_PASSWORD are set, never promotes an existing account or resets its password.

Migrations create the initial schema and PostgreSQL trigram indexes. **For an existing database created before migration history, back it up and reconcile/baseline it before applying migrations. Do not reset an existing database.** The database role must be allowed to install the pg_trgm extension (or ask the database administrator to install it first).

## Use the MVP

1. Register a seller at /ar/account or /en/account.
2. Open the seller dashboard, save store details and a 10-digit commercial registration number, and upload a PDF, PNG or JPEG document (5 MB maximum).
3. Sign in as the seeded administrator. Review/download the private document and approve the seller.
4. Add offers or import a CSV/XLSX file in the seller dashboard. Free sellers may list 10 products. Bulk import requires an eligible plan (Pro/Business by default); start a Pro trial to test it. Imports are atomic; any error rolls back the entire file.
5. Shoppers can search Arabic/English text, use autocomplete, filter by category/brand/price/seller rating, sort, paginate and compare available offers from approved sellers.
6. Admins can add brands/categories and merge canonical products. Merges reject cases where a seller lists both products; remove the duplicate offer first.

Changing a store profile or verification document returns the seller to pending review and hides its offers until approved again. Seller ratings default to zero; review collection belongs to Phase 3.

## Imports

External-store monitoring includes scheduled discovery, a durable PostgreSQL job
queue, a separate worker, conservative product matching, and GIN full-text search.
See the [complete pipeline setup](docs/comparison-pipeline.md) to run the scheduler
and worker separately and inspect job/review status.
See [external product sync setup](docs/external-product-sync.md) for source
configuration, scheduling, change history, migrations, and current limitations.

Download /import-template.csv. Columns:

`title,brandId,categoryId,barcode,descriptionAr,descriptionEn,images,price,stock,productUrl,sku`

Required: title, brandId, categoryId, images, price, stock. Images may be empty; otherwise separate HTTPS URLs with `|`. Use the brand/category IDs shown in the dashboard. Barcode is an 8- or 12–14-digit string; format barcode cells as text in Excel to preserve leading zeros. Prices must be positive with at most two decimal places; stock must be a nonnegative integer. CSV must be UTF-8. Maximum 500 rows / 2 MB. Only the first XLSX worksheet is read. Imports create offers; duplicate existing listings are rejected.

Canonical products match by barcode first, then normalized brand + model/title. Sellers edit their own offer content; they cannot overwrite a shared product's canonical description. Admin merge resolves mismatched canonical products.

## Architecture

```text
Browser → Next.js (3001, Arabic/English, HttpOnly session cookie)
             → /api proxy → NestJS (3000, REST/OpenAPI, JWT + database roles)
                                 → Prisma → PostgreSQL
                                 → private verification file directory

apps/web              Next.js 15, React 19, Tailwind 4, next-intl
apps/api              NestJS 12, typed DTO validation, Vitest
packages/database     Prisma 7 client, migrations, seed
packages/ui           Shared typed UI primitives
.github/workflows     Linux CI with PostgreSQL
```

Search uses PostgreSQL ILIKE with trigram indexes, including Arabic text, with aggregation/filtering in the database. Meilisearch and Redis are optional Compose profiles reserved for later scaling; Phase 1 does not require them. Product images are HTTPS URLs rendered directly by browsers, avoiding a server-side arbitrary-image fetcher. Verification documents live in UPLOAD_DIR and are available only to authenticated admins. Back up that directory with the database.

## Verification

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Database integration tests require a **separate disposable database whose name ends in \_test**, with migrations applied:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/menenwbkam_test'
npm.cmd run db:migrate
$env:TEST_DATABASE_URL = $env:DATABASE_URL
npm.cmd run test:e2e --workspace=api
```

Integration tests create uniquely named fixtures and remove only their own records. CI applies migrations to its PostgreSQL service and runs lint, unit tests, integration tests and both production builds.

Production: run migrations and seed explicitly, build with `npm.cmd run build`, then run `npm.cmd run start:prod --workspace=api` and `npm.cmd run start --workspace=web`. Set API_URL and WEB_ORIGIN to the intended internal API and public web origin. Serve the web over HTTPS; production session cookies are Secure. Run behind an ingress with request-size and login-rate limits. No deployment is performed by these commands.

## Scope

Implemented: Phase 0 foundation, Phase 1 price comparison, Phase 2 test subscriptions, and Phase 3 local order operations. Authentication uses email/password; OTP and Google login remain follow-ups. Advanced analytics, favorites, price alerts, mobile apps and external integrations remain later phases. Verification uploads use private local storage; shared object storage is needed for multiple API replicas.

## Phase 3 — orders and seller operations

- Shopper orders: `/ar/orders` or `/en/orders`.
- Seller orders: `/ar/seller/orders` or `/en/seller/orders`.
- Order details and dispute conversation: `/ar/orders/ORDER_ID` (or `/en`).
- Notification inbox: `/ar/notifications` or `/en/notifications`.
- Admin mediation and review reports: `/ar/admin/operations` or `/en/admin/operations`.

Run `npm.cmd run db:migrate` and `npm.cmd run db:generate` after updating. The two
Phase 3 migrations add order snapshots/history, review moderation, disputes and
notifications, while preserving existing offers and subscription settings.

To try the flow, sign in as a **SHOPPER**, open a product comparison page and click
**Order from this seller**. Confirm quantity, contact details and delivery address.
The API validates the reviewed unit price, computes the subtotal, checks seller
approval and reserves stock in one transaction. Checkout keys make retries
idempotent; orders cannot combine sellers. If a price changed, refresh the checkout
before placing the order. The current UI orders one offer at a time; the API
supports up to 20 distinct offers from one seller.

Sign in as that seller to accept, ship and deliver the order. Shipping requires a
delivery method and tracking reference; an HTTPS tracking URL is optional. New
orders may be cancelled by the shopper; sellers may cancel new/accepted orders.
Shipped/delivered orders may be marked returned by the seller. Cancellation and
return replenish stock exactly once. Archived item titles and prices remain intact
when a seller edits an offer or an admin merges canonical products. Offers used by
orders cannot be deleted; set stock to zero to stop new orders.

**Payment and delivery remain entirely with the seller.** Order totals are product
subtotals, excluding delivery charges, which the seller confirms directly. The
platform collects no order payment and performs no automatic refunds or shipping.
Admin dispute resolutions record the agreed action; the seller executes it.

After delivery (including orders subsequently returned), the purchaser can leave
one seller review and one review per purchased product. Ratings are 1–5 stars.
Public reviews omit account emails, and hidden seller reviews are excluded from
the seller's aggregate rating. Authenticated users can report another user's
review; admins can keep/hide it with a recorded reason. Both order participants
can open one dispute per order, exchange private messages and ask admin to mediate.
Resolved disputes are closed to further messages. Shopper/seller access is scoped
to their own orders; admins have mediation access.

Notifications are recorded transactionally with order/dispute/moderation events.
The inbox, unread counts and read actions work locally. **Email, WhatsApp and push
deliveries are previews only**: each notification records its three channel
previews, and no external messages are sent. Provider credentials, delivery
adapters, consent/preferences and retry workers are still required for real
external delivery. The inbox explicitly labels this limitation.

Verification includes overselling races, duplicate checkout, price tampering,
order transitions, stock restoration, tenant isolation, verified reviews, report
moderation, dispute closure, notification privacy and canonical-product merge
history. Subscription enhancements remain deferred; Phase 4 adds the seller workspace.

## Phase 2 — test subscriptions

Seller billing: `/ar/seller/billing` or `/en/seller/billing`.
Admin plans, coupons and revenue: `/ar/admin/billing` or `/en/admin/billing`.

Run `npm.cmd run db:migrate` and `npm.cmd run db:seed` after updating. The seed adds
Free (10 products), Starter (100), Pro (1,000), Business (unlimited), and custom
Enterprise plans without replacing admin edits. Default plan prices are sample
prices in SAR, excluding VAT. Yearly prices are annual totals.

1. Use an approved seller account. Start the Pro trial to test bulk upload and
   featured badges; each seller can start a trial only once.
2. Choose monthly/yearly billing and optionally a coupon, then create a test
   invoice. Simulate success or failure from the invoice list. No card details or
   real payment provider are used. The invoice page supports printing / saving PDF.
3. To test renewal, create a renewal invoice, click **Simulate period end**, then
   simulate payment. Scheduled changes apply when the due renewal is paid, never
   before the current period ends. Early renewal payments are rejected.
4. Unpaid paid-plan renewals enter the configurable grace period. **Simulate grace
   expiry** tests the Free fallback. Trials expire directly without paid grace.
5. Cancellation retains benefits until period end and voids unpaid invoices.

`BILLING_MODE=test` is the local default. Simulation endpoints (including time
advancement and trials) are disabled when NODE_ENV=production, even if test mode
is configured. Real hosted checkout, recurring charges and payment webhooks are
not implemented. Subscription expiry and entitlements are evaluated on requests;
there is no scheduled payment collection or automatic renewal invoice generation.
Use the test controls to create renewal invoices and simulate collection.

Bulk upload now requires an enabled `bulkUpload` entitlement (Pro/Business by
default), checked inside the import transaction. Featured offers require
`featuredBadge`, checked by the API and hidden when entitlement expires. Existing
listings are retained after cancellation/expiry; sellers must get below their
effective plan limit before creating more. Scheduled downgrades are rejected when
the seller already exceeds the target limit. Analytics, price history, API access,
priority placement and teams are configurable feature flags reserved for later
phases; they are not implemented by purchasing a test plan.

Immediate plan purchases start a full new period without proration, credits or
refunds. Schedule a change to retain the current paid period. Coupons apply to one
invoice, are redeemed only on successful simulated payment, and enforce global
redemption limits under concurrent requests. Failed invoices can be retried;
replaced/cancelled invoices are void. Repeated payment-success requests are
idempotent. Prices, buyer/supplier details, discounts and VAT are snapshotted on
invoices so later plan edits do not rewrite history. Revenue views separate test
totals from live totals, which remain zero.

`BILLING_VAT_BPS=1500` means a **test** VAT rate of 15%; configure the rate and the
test supplier name/VAT number through `.env`. Amounts and rounding use integer
halalas. These are clearly marked test documents, **not certified ZATCA electronic
tax invoices**. Live invoicing and provider integration require separate work.


## Phase 4 ? seller workspace

Open /ar/seller or /en/seller for the redesigned dashboard. Separate navigation
provides Products, Orders, Pricing and alerts, Reports, Team, and Store settings.
Products moved to /seller/products; legal verification is in Settings.

- Real views, clicks, daily activity, orders, delivered order value, conversion
  and top products. Date ranges use Riyadh days. Delivered value uses current
  delivered status and order creation date, rather than collected payments.
- Impressions/clicks are deduplicated per offer/browser session/day. Session UUIDs
  become seller-scoped HMAC hashes. Tracking begins at enablement, with no invented
  past data. Conversion is indicative session attribution, not cross-device identity.
- Pricing compares approved in-stock competitors for the same canonical product.
  Suggestions are one halala below the cheapest competitor, bounded at SAR 0.01.
  Own price history begins at the migration baseline and records actual changes.
  Low-stock and price-drop alerts use the local inbox and delivery previews.
- Owners invite existing SELLER accounts; recipients must accept. Manager manages
  catalog, orders, analytics and branding; Catalog manages listings; Orders handles
  fulfillment; Analyst reads catalog/analytics. Only owners manage team, legal
  verification and billing. Expired team entitlement or revocation removes access.
- Branding supports a unique public slug, description, HTTPS logo/banner and color.
  Approved storefronts appear at /ar/stores/{slug} or /en/stores/{slug}. Public
  fields exclude private verification details. Store selection uses an HttpOnly
  cookie; every API request revalidates membership and role.
- Reports provide real Excel workbooks of aggregate daily/top-product data without
  shopper contacts. Print / Save PDF uses the browser report page. These are
  operational reports, not certified tax documents.

Analytics, history and team features honor existing plan flags. Basic counts remain
available without analytics. Subscription enhancements remain deferred, payments
remain test-only, and notifications remain local previews. Phase 5 is not started.

Verification: 26 unit tests, 49 PostgreSQL integration tests, clean lint/formatting,
production builds and HTTP smoke checks. Clean Chrome checks cover dashboard
routes, product editor/cancel, Excel/PDF and Arabic mobile layout. Disposable
browser fixtures are removed after verification.

## Saved products and shared shopping lists

Authenticated shoppers can save a product from its comparison page and manage it
at `/ar/saved` or `/en/saved`. They can create named lists, add a specific seller
offer with a quantity, and share a read-only URL. Lists show current prices and
availability, group items by seller, and calculate the live combined estimate.
The existing one-seller-per-order rule remains in force: each seller group links
to its own checkout. A shared URL exposes only the list name and live offer data;
it never exposes shopper account, address, or order data.
