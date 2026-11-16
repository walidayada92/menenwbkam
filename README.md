# Menenwbkam — منين وبكام

Public, Arabic-first price comparison for Saudi stores. Search saved products,
compare prices and availability, and visit the store to buy. No signup, cart,
checkout, seller dashboard or billing is exposed in this launch.

The complete earlier marketplace is preserved on `marketplace/future-phase`
(snapshot `cabab80`). This release is `launch/price-comparison`; `main` is unchanged.
See [production launch and Vercel setup](docs/production-launch.md) for hosting,
branch integration, domain, worker, security and operational requirements.

## Local development

Requires Node.js 24, npm and PostgreSQL 16+. From PowerShell:

```powershell
Copy-Item .env.example .env
# Set DATABASE_URL and a random API_PROXY_SECRET (32+ characters) in .env.
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run dev
```

Do not overwrite an existing .env. For an existing database, follow the migration
and backup guidance before applying migrations. Do not reset or seed marketplace
fixtures for this comparison release.

Web: http://localhost:3001/ar or /en. API health: http://localhost:3000/health/ready.
The web uses its same-origin allowlisted /api proxy. API_PROXY_SECRET is server-only.

## Data collection

The site reads PostgreSQL's saved product/search index. Refreshing prices requires
the separate scheduler and queue worker:

```powershell
npm.cmd run build --workspace=api
npm.cmd run pipeline:bootstrap
npm.cmd run pipeline:scheduler
# In another terminal:
npm.cmd run pipeline:worker
```

Public query-triggered collection is disabled by default in production. Sources
may be unavailable; Noon has had access timeouts. A connector is not a guarantee of
source coverage. Prices show their observation dates, and review scores are not
fabricated. Details: [pipeline](docs/comparison-pipeline.md).

## Validation

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:smoke
```

The launch smoke uses DATABASE_URL for read-only checks; it starts temporary
production servers and verifies comparison pages/API and marketplace isolation.

## Deployment

Vercel web project: Root Directory `apps/web`, Node 24. Optional Vercel NestJS API
project: Root Directory `apps/api`. Configure workspace access and production
environment values. Use managed PostgreSQL and a persistent worker runtime.
The confirmed public domain is `menenwbkam.com`. Set production
`NEXT_PUBLIC_SITE_URL=https://menenwbkam.com`; follow the deployment guide for DNS.
No deployment, remote push or DNS change is implied by preparing this source.
