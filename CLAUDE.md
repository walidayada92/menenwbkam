# Project: Menenwbkam (menenwbkam.com)

## Active launch scope — 2026-11-16

The user authorized a comparison-only public launch, with no signup, marketplace,
checkout, billing or seller dashboards. `launch/price-comparison` is the release
branch. The complete earlier marketplace is preserved at `cabab80` on
`marketplace/future-phase`; merge it only when the user authorizes that next phase.
This section supersedes the historical implementation/phase guidance below.
Keep the existing schema and data; do not drop/reset marketplace records. Public
API controllers are registered only by ComparisonModule. New features must not
reintroduce marketplace routes. Production requires a server-only API_PROXY_SECRET.
Read docs/production-launch.md before deployment. The user confirmed the public
domain as menenwbkam.com. Use https://menenwbkam.com as the production site origin.
No DNS or hosting changes have been authorized for a particular account yet.
Signup is deferred: consider Google login when alerts/account sync are introduced.
Never claim all-store coverage or real review scores without source data.

## Vision

Build the best price-comparison marketplace and SaaS platform. Shoppers search
for any product and instantly see the best prices from many sellers. Sellers
(merchants) register, add their own products, manage everything from their own
control panel, and pay a monthly/yearly subscription to list more products.
Each seller handles order fulfillment and delivery fully on their own;
the platform never touches shipping.

Domain (already reserved): menenwbkam.com

## Users

1. Shopper (customer): searches, compares prices, saves favorites, sets price alerts.
2. Seller (merchant): manages products, prices, orders, subscription, analytics.
3. Platform admin (me): manages sellers, plans, approvals, reports, disputes.

## Key rules

- Arabic-first with full RTL, plus English. Currency SAR by default, multi-currency ready.
- Mobile-first responsive web, then native mobile app sharing the same API.
- Delivery is 100% handled by each seller. The platform only forwards order
  details to the seller and shows order status the seller updates.
- Each seller has a separate dashboard, and sellers can only ever see their own data.
- Subscription plan limits (product count, features) are enforced on the server, not just the UI.

## Working method (follow strictly)

1. Before writing code, explore the current folder and propose the tech stack,
   folder structure, and database schema. Wait for my approval.
2. Create a CLAUDE.md with the stack, commands, conventions, and the phase checklist.
3. Work ONE phase at a time. At the end of each phase: run tests, summarize what
   was built, list what is left, and ask before starting the next phase.
4. Write clean, typed, tested code. Commit often with clear messages.
5. Never hardcode secrets. Use .env files and provide a .env.example.
6. I use Windows + PowerShell, so give Windows-compatible commands.

## Suggested stack (propose changes if you have better reasons)

- Web: Next.js (TypeScript) + Tailwind, RTL support, i18n (ar/en)
- API: Node.js (NestJS or Next.js route handlers) with REST, OpenAPI docs
- Database: PostgreSQL with Prisma. Search: Meilisearch or Typesense (good Arabic support)
- Auth: email/phone OTP + Google login, role-based access (shopper/seller/admin)
- Payments/subscriptions: a gateway that supports Saudi Arabia (Moyasar, Tap, or Stripe if available), with mada support
- Storage: S3-compatible object storage for product images
- Mobile: React Native (Expo) using the same API
- Hosting: Docker-based, CI/CD with GitHub Actions

## Phases

### Phase 0: Foundation

Repo setup, monorepo structure, lint/format, CI, Docker for local dev,
database schema and migrations, auth, roles, i18n/RTL base, design system
(colors, logo placeholder, components).

### Phase 1: MVP, search and compare

- Seller registration + verification (commercial registration / ID upload, admin approval)
- Seller dashboard v1: add/edit/delete products (title, description, images,
  category, brand, price, stock, product URL or SKU)
- Bulk upload via Excel/CSV
- Product matching: group the same product from different sellers into ONE
  product page (by barcode/GTIN, brand + model, with admin merge tool)
- Shopper site: fast search with autocomplete, filters (price, brand, category,
  seller rating), sorting, product page showing all seller prices from lowest
  to highest with a "Best price" badge
- Free plan with a low product limit

### Phase 2: Subscriptions and SaaS

- Plans (suggested, adjustable in admin):
  - Free: ~10 products, basic listing
  - Starter: ~100 products, basic analytics
  - Pro: ~1,000 products, bulk upload, price-history analytics, featured badge
  - Business: unlimited products, API access, priority placement, team members
  - Enterprise: custom
- Monthly/yearly billing with discount, free trial, upgrade/downgrade, invoices
  (with VAT), failed-payment handling and grace period, cancellation
- Server-side plan limit enforcement
- Admin panel to edit plans, coupons, and view revenue

### Phase 3: Orders and seller operations

- Shopper places an order or "buy from this seller"; the order goes to the seller
- Seller order management: new/accepted/shipped/delivered/cancelled/returned,
  seller enters delivery method and tracking info
- Email/WhatsApp/push notifications to seller and shopper
- Ratings and reviews for sellers and products, with abuse reporting
- Seller dispute flow with admin mediation

### Phase 4: Seller control panel and dashboard (advanced)

- Dashboard: views, clicks, orders, revenue, conversion, top products
- Price intelligence: seller's position vs competitors, suggestions to be
  the cheapest, low-stock and price-drop alerts
- Team members with roles, store profile page, branding
- Export reports (PDF/Excel)

### Phase 5: Growth and quality

- Price history charts and "price dropped" alerts for shoppers
- SEO: server-rendered pages, structured data (Product/Offer), sitemap,
  clean Arabic URLs
- Seller price/stock sync via API and plugins (Shopify, Salla, Zid, WooCommerce)
- Recommendations, trending deals, deals page, coupons
- Admin tools: fraud detection, fake-price detection, moderation, audit logs
- Performance, caching, monitoring (Sentry), backups, security review, load testing
- Legal pages: terms, privacy, seller agreement, refund policy (PDPL compliant)

## Extra ideas to evaluate and add where they fit

- Sponsored/featured listing placement as an extra revenue stream
- Seller verification badge and trust score
- Price comparison including delivery cost and delivery time
- Browser extension that shows the best price while the user browses other stores
- WhatsApp bot for searching prices
- Shopper wishlist sharing, and shopping lists with total basket price
  across sellers

### Final phase: Mobile app

- React Native (Expo) apps for shoppers (search, barcode scan to compare
  prices, favorites, price alerts, push notifications, orders)
  and a seller app (orders, quick price/stock edit, notifications)

## Deliverable for this first session

1. Review the folder, then reply with: proposed stack, architecture diagram
   (text), folder structure, database schema (tables and relations), and a
   detailed Phase 0 and Phase 1 task checklist.
2. Do not write any code until I approve this plan.

## Implementation status — 2026-11-01

The user authorized finalizing both Phase 0 and Phase 1 in this session. Do not
start Phase 2 without new authorization. The original product vision above remains
the roadmap; this section documents the actual implementation.

### Implemented stack and conventions

- npm workspaces + Turborepo 2; Node.js 24; Windows-compatible npm.cmd commands.
- Next.js 15.5 / React 19 / Tailwind 4 / next-intl; Arabic defaults to /ar with RTL,
  English uses /en. Typed UI components live in packages/ui.
- NestJS 12 REST API with strict TypeScript, whitelisted typed DTOs and generated
  OpenAPI schemas at /api/docs. Never accept tenant IDs from seller request bodies.
- Prisma 7 + PostgreSQL; all schema changes need committed migrations. Matching
  separates canonical Product records from seller-owned Offer records.
- PostgreSQL trigram indexes provide the Phase 1 Arabic/English search backend.
  Meilisearch and Redis remain optional scaling services, not runtime dependencies.
- Browser sessions use HttpOnly cookies through the Next.js /api proxy. API
  clients use JWT bearer tokens. Guards read current roles from the database.
- Verification uploads are private local files, restricted to authenticated admin
  downloads. Product images are HTTPS URLs. Never expose the upload directory.
- Product limits and imports use serializable transactions and per-seller locks.
  Imports are atomic and capped at 500 rows / 2 MB.
- Never commit .env, uploads, generated builds or .local test databases.

### Phase 0 checklist

- [x] Working monorepo commands and portable scripts; production build paths fixed.
- [x] Lint/format configuration, strict API typing and shared UI type checks.
- [x] GitHub Actions with PostgreSQL, migrations, unit/integration tests and builds.
- [x] Docker Compose for local PostgreSQL; optional search/cache profiles.
- [x] Database schema, three versioned migrations, search indexes and idempotent seed.
- [x] Email/password authentication, safe registration responses, server-side roles,
      seller isolation and HttpOnly browser sessions.
- [x] Arabic/English routes, translated flows, mobile layout and RTL design base.
- [x] Environment template, setup guide and architecture documentation in README.md.

### Phase 1 checklist

- [x] Seller profiles, commercial registration, document upload and admin approval.
- [x] Seller-owned listing creation/editing/deletion with validated price/stock,
      descriptions, image URLs, SKU and external purchase URL.
- [x] Atomic UTF-8 CSV and XLSX bulk upload with template and row validation.
- [x] Canonical matching by barcode and normalized brand/model; admin merge tool
      rejects overlapping seller offers rather than silently deleting data.
- [x] Search/autocomplete, price/brand/category/rating filters, sort and pagination.
- [x] Server-rendered product comparison with lowest-price-first offers and badge.
- [x] Only approved sellers' in-stock offers are public.
- [x] Free fallback limit of 10 products, enforced under concurrent create/import.
- [x] Arabic/English shopper, account, seller and admin interfaces.

### Verification and commands

- npm.cmd run dev — starts both web (3001) and API (3000).
- npm.cmd run db:generate / db:migrate / db:seed — database lifecycle.
- npm.cmd run lint — clean (zero errors or warnings).
- npm.cmd test — 15 unit tests.
- npm.cmd run test:e2e --workspace=api — 12 PostgreSQL workflow tests; requires
  TEST_DATABASE_URL pointing to a dedicated migrated database ending in _test.
- npm.cmd run build — API, shared UI type check and web production build.
- npm.cmd run test:smoke — starts temporary production servers, checks ar/en and
  RTL, session cookies, CSRF, access control, upload, SSR search and comparison,
  then removes only its own fixtures. Requires TEST_DATABASE_URL and built apps.

### Remaining integrations and later scope

Email/password is the implemented authentication method. OTP and Google login from
the suggested stack are not implemented. Shared S3-compatible storage is needed
before running multiple API replicas. Checkout currently links to the seller's
external store; orders, reviews, billing, analytics, mobile and integrations remain
in Phases 2–6. Seller ratings default to zero until the review system is built.
No deployment was performed during Phases 0/1. See the Phase 2 update below.

## Phase 2 update — 2026-11-02

The user authorized the next phase and explicitly selected **test mode only**.
Do not connect a live provider, charge real money or start Phase 3 without new
authorization. The existing stack is retained; billing lives in apps/api/src/billing
and the web seller/admin billing components. Two additive migrations extend Plan,
Subscription and Seller, and add Coupon and Invoice with amount constraints.

- [x] Seeded editable Free / Starter / Pro / Business / custom Enterprise plans.
- [x] Monthly/yearly test pricing, configurable trials and grace periods.
- [x] One trial per seller; approved sellers only; no entitlement from unpaid invoices.
- [x] Immediate purchases, scheduled changes, renewal invoices, cancellation and
      request-time expiry reconciliation. No automatic payment collection.
- [x] Clearly marked payment/time simulation controls, disabled in production.
- [x] Immutable invoice snapshots, integer-halalas VAT and discounts, printable receipts.
- [x] Atomic coupon redemption limits and idempotent payment success handling.
- [x] Server-side effective product limits, bulk-upload gates and featured-badge gates.
- [x] Arabic/English seller billing and admin plans/coupons/simulated-revenue views.
- [x] Added policy and PostgreSQL billing workflow tests, including concurrent
      coupon redemption, expiry and scheduled renewal timing.

Seller route: /ar/seller/billing (or /en). Admin route: /ar/admin/billing.
The existing seller dashboard now links to billing and explains the bulk-upload gate.
Pro trial is the intended way to try bulk upload without payment. Cancellation and
expiry retain existing listings, but prevent creating listings above the effective
limit. Future feature flags (analytics, history, API, teams, priority) do not imply
those later-phase features have been built.

Remaining outside the chosen test scope: live payment gateway, automatic recurring
collection, certified electronic tax invoices, proration/refunds and production
billing operations. No live credentials are required or stored. README.md describes
the test workflow and financial limitations.

Final Phase 2 verification: 19 unit tests and 26 PostgreSQL integration tests pass;
lint has zero errors/warnings; formatting, API/web/shared-UI production builds and
production HTTP smoke checks pass. A clean Chrome workflow verified trial start,
invoice creation, simulated success, grace/expiry, printable invoice rendering and
Arabic RTL admin forms without console errors. Production startup explicitly sets
NODE_ENV=production, and the smoke suite verifies test actions are denied there.
The local dev servers are running on web port 3001 and API port 3000.

## Phase 3 update — 2026-11-02

The user authorized Phase 3 and deferred subscription enhancements. Retain Phase 2
test billing; do not start Phase 4 without authorization. Implementation lives in
apps/api/src/orders and the checkout/order/review/notification/admin-operations web
components. Two additive migrations extend Order/OrderItem and add OrderEvent,
Review, ReviewReport, Dispute, DisputeMessage, Notification and NotificationDelivery.

- [x] Shopper checkout, one seller per order, authoritative prices and immutable
      item snapshots, idempotent retries and atomic stock reservation.
- [x] Seller fulfillment statuses, shipping method/tracking, order history and
      stock restoration exactly once on cancellation/return.
- [x] Shopper/seller order isolation and admin mediation access.
- [x] Verified-purchase seller/product reviews, public rating summaries, abuse
      reporting and admin moderation with rating recalculation.
- [x] Private dispute conversations and admin resolution; closed disputes reject
      further messages. Settlement/refund execution remains with the seller.
- [x] Local notification inbox, unread/read actions and three delivery previews
      per notification, committed atomically with the originating event.
- [x] Arabic/English checkout, order lists/details, reviews, notifications and
      admin operations; seller/admin/account navigation updated.
- [x] Preserve reviewed product and order history when admins merge products.
- [x] Order policy and PostgreSQL workflow tests, including concurrent stock
      reservations, financial snapshots, access control and lifecycle checks.

External email/WhatsApp/push sending is NOT connected. The current implementation
uses local previews pending provider configuration and delivery-adapter work;
do not claim previews are real deliveries. No order payments, shipping service or
automatic refunds are implemented. Prices on orders exclude seller-confirmed
delivery costs. Subscription features and limits remain unchanged in this phase.
See README.md for the operating workflow and remaining integrations.

Phase 3 verification: 22 unit tests, 39 PostgreSQL integration tests, clean lint
and formatting, all production builds and the expanded production HTTP smoke
suite pass. Clean Chrome verified checkout, fulfillment, both review targets,
private dispute mediation, report moderation and the Arabic notification inbox
without console errors. Disposable browser fixtures were removed afterward.
Local web/API servers are running on ports 3001/3000. External notification
delivery remains the explicitly documented unfinished integration.


## Phase 4 update ? 2026-11-02

The user authorized Phase 4 after Phase 3. Implementation is in
apps/api/src/workspace and the workspace web components, with two additive
migrations for branding, teams, engagement, price history, alerts and attribution.

- [x] Responsive Arabic/English seller dashboard with real metrics and charts.
- [x] Competitor position/suggestions, own price history and seller alerts.
- [x] Accepted team invitations, role permissions and store isolation.
- [x] Branding and public storefronts with safe profile fields.
- [x] Aggregate Excel export and browser Print / Save PDF reports.
- [x] Preserve product editor behavior: list actions hidden until Save/Cancel.

Existing analytics/history/team plan flags apply. Billing stays owner-only and
test-only; subscription enhancements are deferred. Notifications remain local
inbox/previews. Delivered value is operational, not collected revenue. Tracking
starts at enablement, uses Riyadh days and seller-scoped hashes. Reports omit buyer
contacts. See README.md for roles, routes and limitations. Phase 5 is not started.

Verification: 26 unit tests, 49 PostgreSQL integration tests, lint/formatting,
production build and HTTP smoke checks pass. Chrome checks dashboard routes,
editor cancel, Excel/PDF and Arabic responsive layout with disposable fixtures.

## Saved products and shopping lists update — 2026-11-03

Implemented the approved wishlist/sharing idea ahead of the wider Phase 5/6
roadmap. WishlistItem, ShoppingList and ShoppingListItem are additive models in
the `20261103000000_shopping_lists` migration. Shopper-only APIs enforce ownership
on every mutable action. A UUID share token provides a read-only public view with
live offer price/stock, seller grouping and an estimated total. It does not expose
shopper information. The shopper UI is `/ar/saved` or `/en/saved`; product pages
can save the product and add an offer to a list. Checkout remains one seller per
order. Phase 5 mobile apps are still not started.

## Growth and quality update — 2026-11-04

The user moved mobile to the final phase and authorized the next phase. The first
growth feature is shopper price history and target-price alerts. The additive
`20261104000000_shopper_price_alerts` migration adds one target per shopper and
canonical product. Product pages show the available 90-day tracked price points
and allow a signed-in shopper to choose a SAR target. Seller price reductions check
active targets transactionally, deduplicate repeat notifications at the same or a
higher best price, and create the existing local inbox/previews notification.
Saved items now lists active targets and supports removal. Price history begins
with existing seller history; it does not invent historical prices. Mobile remains
the final, unstarted phase.
