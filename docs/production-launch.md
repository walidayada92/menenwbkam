# Comparison-only launch

The public journey is search → compare → visit store. No customer signup, cart,
checkout, billing, seller dashboard or public admin routes. Existing marketplace
database tables and records remain untouched. The API loads ComparisonModule only.

## Branches and future integration

- `marketplace/future-phase`: source snapshot `cabab80`, including the earlier
  marketplace, orders, billing, seller tools and comparison work.
- `launch/price-comparison`: comparison-only release, based on that snapshot.
- `main`: unchanged. Do not point production at main until an intentional release merge.

The snapshot is an ancestor of the launch branch. A future merge of the unchanged
snapshot alone will be a no-op. Develop the next phase on a branch from the launch
release and restore the required marketplace paths from the snapshot with
`git restore --source marketplace/future-phase -- <specific-paths>`, then reconnect
modules and add migration/route tests in a reviewed PR. Do not overwrite the launch
branch with a wholesale checkout of the old AppModule or home page.

## Recommended initial hosting

Use Vercel for the Next.js web application. Use a second Vercel project for the
NestJS API, or run the API container on a persistent Node/Docker host. Use managed
PostgreSQL 16+ with TLS, backups and a pooled runtime connection string.

NestJS supports Vercel Functions natively:
https://vercel.com/docs/frameworks/backend/nestjs . The existing scheduler and worker
are long-running queue consumers and must run on a persistent worker host. Vercel
also offers Daemons in beta (https://vercel.com/docs/daemons), but that is a separate
runtime to configure, not something an ordinary Function starts automatically.
Choose worker infrastructure deliberately before promising automatic fresh prices.

### Vercel web project

Import this repository, choose the `launch/price-comparison` production branch,
Root Directory `apps/web`, Node 24, and enable access to source files outside the
Root Directory (workspace imports). The committed vercel.json sets install/build
commands. Deploy a preview first.

Set server environment variables in both Preview and Production:

| Variable | Value |
| --- | --- |
| `API_URL` | HTTPS origin of the API project; no trailing slash |
| `API_PROXY_SECRET` | A random secret of at least 32 characters; identical on API |
| `NEXT_PUBLIC_SITE_URL` | Exact confirmed public HTTPS origin, e.g. `https://your-domain.com` |

`API_PROXY_SECRET` must remain server-only. Do not add `NEXT_PUBLIC_` to it. Never
configure a production API URL or database credentials in browser JavaScript.
The web project needs no database credentials. Rebuild after changing the public
site URL because sitemap and robots metadata are generated at build time.

### API project

Root Directory `apps/api`, NestJS framework, Node 24, with workspace files included.
The native entrypoint is `src/main.ts`; the committed vercel.json generates Prisma
and builds the API. Prefer the same region as PostgreSQL and the frontend runtime.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Production PostgreSQL URL using verified TLS; use provider pooling |
| `API_PROXY_SECRET` | Same server-only random secret as web |
| `WEB_ORIGIN` | Confirmed frontend origin |
| `PUBLIC_DISCOVERY_ENABLED` | `false` for launch |
| `EXTERNAL_SYNC_ENABLED` | `false`; no in-request/embedded crawler |
| `EXTERNAL_BROWSER_ENABLED` | `false` on the request-serving API |

The API fails startup if the production proxy secret is missing or too short.
Only health routes accept unauthenticated requests. The frontend proxy is an exact
allowlist and does not forward authentication/session cookies or marketplace paths.
If Vercel Deployment Protection protects the API, configure supported service access
or use a public API deployment protected by API_PROXY_SECRET; test the connection
from the web project. Never disable protections without understanding that change.

For a container host, build from repository root:

```powershell
docker build -f docker/Dockerfile.api -t menenwbkam-api .
```

The image runs as the non-root `node` user. Supply secrets through the host's
environment/secrets manager. No .env, local database, logs or workbooks enter the
build context. The Docker image definition still requires an actual Docker build
on the deployment host; a successful native application build is not image validation.

### Database and workers

Back up an existing database before release. Run migrations once as an explicit
release step with an appropriate migration connection/role:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run build --workspace=api
npm.cmd run pipeline:bootstrap
npm.cmd run worker --workspace=api -- --drain --kinds=MATCH,INDEX
```

Do not run marketplace seed for this launch. Do not reset the database. A database
created before migration history needs a reviewed baseline; never blindly apply
the initial migration to a populated untracked schema. The role needs permission
to create pg_trgm or an administrator must provide it.

Run the worker and scheduler as separately supervised processes on the worker host:

```powershell
npm.cmd run pipeline:worker
npm.cmd run pipeline:scheduler
```

Worker and API must share the same database. The default worker can run HTTP-based
sources without Chrome. Browser collection requires an appropriately configured
browser host and verification of permitted source access. Do not expect Noon to
work simply because credentials or a browser are available: its local searches
have timed out. No access-challenge bypass is implemented.

Configure monitored search schedules before launch. With public discovery disabled,
users can search the saved index immediately, but a new term does not cause a fresh
crawl. Direct store-search links remain available. This avoids arbitrary public
queries starting long/expensive scraping jobs before monitoring and limits are ready.

## Domain

Confirm the spelling first: the repository uses **menenwbkam.com**, while the user
also mentioned **menewbkam.com**. Do not change DNS based on that ambiguity.
In the web project's Domains settings, add the confirmed domain and follow the
exact DNS records Vercel shows for that project. Configure one canonical hostname,
redirect the other hostname, set NEXT_PUBLIC_SITE_URL, rebuild and verify HTTPS.
Do not copy guessed IP addresses or DNS records from an old guide.

## Release checks

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:smoke
```

The comparison smoke starts temporary production servers on 3300/3301 and performs
read-only requests using DATABASE_URL; it does not create/delete product fixtures.
It checks ar/en pages, API proxy access, saved search results, autocomplete, aliases,
information pages, sitemap and forbidden marketplace routes. Old marketplace
integration tests belong to the preserved phase; CI no longer runs them against
the intentionally narrowed launch API.

Before public traffic, run smoke checks against the preview environment too and
verify mobile/desktop layout with a browser. Set hosting firewall rate limits for
`/api/catalog/*`, stricter limits for `/api/catalog/external-prices/discover`, and a
spend cap. In-process limits are per API instance; distributed abuse protection is
the hosting firewall's responsibility. Proxy client keys rely on platform-overwritten
forwarded-IP headers; on another host, strip client-supplied forwarded headers at
the ingress. No raw client IP is stored in application history.

Monitor `/health/live` and `/health/ready`, server 5xx rates, queue FAILED jobs,
worker logs/heartbeat and the age of successful price observations. Configure
alerts and database backups, then perform a restore drill on a separate database.
Retain logs for a defined operational period. A source may be blocked or stale;
the UI displays observation dates and does not claim live prices or invented reviews.

Privacy/how-comparison pages describe current behavior; confirm operator contact
and actual hosting/log-retention practices before public launch. No regulatory
certification or legal review is implied.

## Accounts in the next phase

No signup is needed for awareness and price comparison. Add accounts when there is
a user benefit such as price alerts or cross-device saved lists. Start with Google
OpenID Connect if appropriate; Facebook login and WhatsApp OTP need separate app/
provider setup, consent, delivery/cost controls and abuse prevention. A Gmail address
is not itself an authentication method. Never collect a Google/Facebook password.

## Rollback

Use the previous comparison deployment on the hosting platform; do not roll back
to the preserved marketplace snapshot as a public release. Existing migrations
are unchanged by this launch. Disable a failing source/worker independently of
the public read-only comparison service.
