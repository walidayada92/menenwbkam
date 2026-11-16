# Marketplace API

See [the root README](../../README.md) for setup, migrations, environment variables and tests.

| Route                                                           | Access                                            |
| --------------------------------------------------------------- | ------------------------------------------------- |
| POST /auth/register, /auth/login                                | Public (SHOPPER or SELLER registration only)      |
| GET /auth/me                                                    | Authenticated                                     |
| GET /catalog/taxonomy, /catalog/products, /catalog/autocomplete | Public                                            |
| GET /catalog/products/:id                                       | Public; approved sellers and in-stock offers only |
| GET/PUT /seller/profile                                         | Seller                                            |
| POST /seller/verification                                       | Seller; multipart field file                      |
| GET/POST /seller/offers                                         | Seller; creation requires approval                |
| PUT/DELETE /seller/offers/:id                                   | Owning seller                                     |
| POST /seller/import                                             | Approved seller; multipart CSV/XLSX field file    |
| GET /admin/sellers                                              | Admin                                             |
| PUT /admin/sellers/:id/review                                   | Admin                                             |
| GET /admin/sellers/:id/verification                             | Admin; attachment download                        |
| POST /admin/brands, /admin/categories                           | Admin                                             |
| GET /admin/products, POST /admin/products/merge                 | Admin                                             |

API clients use Authorization: Bearer TOKEN. Browser clients use Next.js /api routes, with an HttpOnly session cookie. OpenAPI is available at /api/docs.

Phase 2 endpoints use `/seller/billing` (state), `/plans`, `/trial`, `/checkout`,
`/renew`, `/schedule`, `/cancel`, `/simulate-time`, `/invoices/:id` and
`/invoices/:id/simulate`. Seller identity always comes from the authenticated user.
Admin endpoints are `/admin/billing/plans`, `/plans/:id` (PUT), `/coupons`,
`/coupons/:id` (PUT), and `/revenue`. Payment/time simulation and trial endpoints
are test-only and reject requests in production. See the root README for semantics.

Phase 3:

| Route                                                                 | Access                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| POST /orders                                                          | Shopper; idempotent checkoutKey, validated items and reviewed unit prices |
| GET /orders, GET /orders/:id                                          | Owning shopper/seller, or admin                                           |
| PUT /orders/:id/status                                                | Owning seller; shopper may cancel a new order                             |
| POST /orders/:id/reviews                                              | Verified purchaser after delivery/return                                  |
| POST /orders/:id/dispute                                              | Order participants                                                        |
| POST /operations/disputes/:id/messages                                | Order participants or admin                                               |
| GET /operations/notifications, PUT /operations/notifications/read     | Current user only                                                         |
| POST /operations/reviews/:id/report                                   | Authenticated user, excluding the author                                  |
| GET /admin/operations/disputes, GET /admin/operations/reports         | Admin                                                                     |
| PUT /admin/operations/disputes/:id, PUT /admin/operations/reviews/:id | Admin                                                                     |
| GET /catalog/offers/:id                                               | Public checkout quote, approved seller/in-stock only                      |
| GET /catalog/products/:id/reviews, GET /catalog/sellers/:id/reviews   | Public visible reviews                                                    |

Order, review and operations lists accept page (20 items per page); orders also
accept status. Notifications have local EMAIL/WHATSAPP/PUSH previews, not external
delivery. No subscription or order money is collected by these Phase 3 routes.
