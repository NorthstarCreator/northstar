# NorthStar Future Schema Plan

This document is intentionally planning-only. It defines the next schema areas without
creating commerce ingestion, seed data, mock data, sandbox data, or local-browser data.

## Implemented Import Policy Foundation

Migration `003_source_import_policies.sql` adds metadata for one historical-import
decision per exact creator account and official source. It records the selected
range mode, requested and effective boundaries, provider availability, reporting
timezone, approval state, and controlled first-import state. The migration inserts
no policies and does not alter the existing Display API cutoff or persisted data.

Supported source codes are deliberately limited to `tiktok_display_api`,
`tiktok_shop`, `creator_rewards`, and `tiktok_go`. Demo data, screenshots, and
reference spreadsheets are not import sources. All Accounts remains a calculated
rollup because policies require a real `creator_accounts.id` foreign key.

## Future Commerce Tables

- `products`: TikTok product IDs, account ownership, seller/brand, category, product image, price, status, and first/last sync provenance.
- `video_products`: many-to-many relationship between `videos` and `products`, unique by `video_id` and `product_id`.
- `orders`: order-level records when a platform provides durable order IDs.
- `sales_daily`: daily aggregated product/video sales when order-level records are unavailable.
- `refunds`: refund records tied to orders, products, videos, or daily sales aggregates.
- `samples`: product sample lifecycle records tied to account and product when identifiers are available.
- `creator_rewards_daily`: daily Creator Rewards earnings by account and, when available, video.
- `tiktok_go_rewards_daily`: daily TikTok GO earnings by account, campaign, and content when available.
- `external_revenue_events`: non-TikTok revenue sources for future unified earnings reporting.

## Dormant LIVE Shopping Foundation

Northstar now has a provider-neutral, non-persistent LIVE Shopping domain model
for future TikTok Shop Affiliate Creator access. It defines exact-account LIVE
sessions, replay information, product-to-LIVE relationships, hourly affiliate
metric buckets, orders, units, GMV, estimated and final commission, refunds, and
sales/GMV per hour. No database table, migration, route, writer, import handler,
queue, token exchange, or TikTok request implements this model.

The accepted provenance values are `manual`, `imported`, and `tiktok_api`.
Manual and Imported records can be validated by the domain model after a future
reviewed entry/import workflow exists. `tiktok_api` is fail-closed and cannot
construct a record until Affiliate Creator API access is authorized and a
provider implementation is separately approved. The Data Portability Full
Archive is not an allowed source.

If persistence is later approved, use new tables rather than extending Display
API video tables:

- `live_shopping_sessions`: exact `creator_accounts.id`, explicit Affiliate
  Creator provider, source, provider-neutral title, start/end, replay
  availability/reference/publication/expiration, and safe provenance ID;
- `live_shopping_products`: exact account/session/product relationship,
  featured/removed timestamps, source, and safe provenance ID;
- `live_shopping_affiliate_metrics`: exact account/session and optional linked
  product, bounded time bucket, orders, units, GMV minor units, estimated/final
  commission minor units, refund count/GMV/commission, source, and safe
  provenance ID.

Uniqueness and foreign keys must prevent account, session, product, or source
identity changes. All Accounts must remain calculated. LIVE gifts require a
different revenue source and table/connection boundary; gift values must never
enter LIVE Shopping GMV, order, unit, commission, refund, or sales-per-hour
calculations.

The model intentionally has no fields for direct messages, phone numbers, email
addresses, physical addresses, login IPs, payment details, searches, watch
history, customer-service conversations, or shopper activity. Future schema
review must preserve that exclusion.

## Implemented Provider-Neutral Domain Foundation

The application now defines separate, fail-closed provider adapters for TikTok
Shop, Creator Rewards, and TikTok GO. These adapters expose account-scoped
readiness only. They deliberately expose no HTTP endpoint, OAuth method, scope,
payload field, pagination rule, rate limit, availability window, timezone rule,
provider idempotency field, connection action, or import action.

Every adapter reports the following details as unconfirmed blockers until
official TikTok Partner/API documentation and account approval establish them:

- provider endpoint and authentication method;
- permissions/scopes and approval requirements;
- payload schema and exact provider account identifier;
- pagination and rate-limit behavior;
- historical availability and timezone semantics;
- provider-owned idempotency identifiers.

The provider-neutral job contract implements validation, deterministic
account/source/opaque-operation-UUID idempotency keys, lifecycle transitions, immutable
account/source identity, standardized safe errors, and append-only audit-event
values. This is domain logic only. It does not persist, enqueue, execute, or
transmit a job.

## Planned Provider-Neutral Persistence (Not Migrated)

No migration implements the following structures yet. Their final columns and
constraints require a separate review before any SQL is created or executed.

- `revenue_provider_connections`: one exact `creator_accounts.id` and source;
  connection state, provider availability, approval state, blocker codes, and
  configuration revision. It must reject calculated identities and must not
  store tokens unless a separately approved credential design requires it.
- `revenue_import_jobs`: exact account/source identity, normalized lifecycle
  state, deterministic idempotency key derived from a non-personal operation UUID,
  approved policy reference, explicit
  requested/effective range, revision, and safe failure status. Unique by the
  idempotency key and account/source boundary.
- `revenue_import_job_events`: append-only job audit trail with exact account,
  source, job revision, event type, actor type, safe status code, and timestamp.
  Raw credentials and unbounded provider payloads are forbidden.
- `revenue_provider_checkpoints`: provider cursor or watermark only after its
  meaning, account binding, replay behavior, and confidentiality are documented.

The existing migration `003_source_import_policies.sql` remains unexecuted and
unchanged. These planned tables are not part of migration 003.

## TikTok Shop Application And Identity Separation

TikTok Shop Partner Support has confirmed that the existing Northstar Creator
Custom / Local Sellers app is seller-facing and cannot provide Northstar's
creator-affiliate integration. It is reserved unchanged for a possible future
seller-authorized integration; its seller scopes remain inactive.

Northstar's primary creator integration requires a separate Affiliate app in the
Affiliate service category and United States market, beginning with a custom app
for development/testing. It must use the app's approved Affiliate Creator API
scopes and TikTok Shop Creator Authorization, which is separate from both TikTok
for Developers Login Kit and TikTok for Business authorization.

Future connection storage must distinguish these provider identities:

| Provider code (proposed) | Authorization family | Provider identity | Internal owner |
| --- | --- | --- | --- |
| `tiktok_content` | TikTok for Developers Login Kit | Display API Open ID | exact `creator_accounts.id` |
| `tiktok_shop_affiliate_creator` | TikTok Shop Creator Authorization | confirmed Affiliate creator ID/Open ID | exact `creator_accounts.id` |
| `tiktok_shop_seller` | Local Sellers seller authorization | confirmed seller/shop identity | a separately verified seller/shop owner linked to an exact account only when appropriate |

Each provider requires separate app credentials, authorization routes, scope
records, token records, refresh lifecycle, connected identity, connection row,
revocation/disconnect behavior, idempotency domain, and audit trail. An
Affiliate creator identity must never be inferred from a Display API Open ID or
a seller/shop identity. Provider records may be related only through the exact
Northstar creator-account UUID after provider-specific ownership verification.

The current generic `tiktok_shop` source code may remain a dashboard aggregation
label temporarily, but it is not sufficient as a credential or connection
identity. Before persistence is implemented, schema design must use explicit
Affiliate Creator and Seller provider codes or an equally strict provider-type
column and uniqueness boundary.

The committed OAuth state foundation remains disabled and planning-only. Its
opaque state, digest-only key, TTL, atomic consumption, replay protection,
session binding, exact-account validation, and fail-closed environment guard are
reusable. Its `tiktok_shop` provider constant, `creator_authorization` purpose,
authorization URL, parameter names, credential environment name, callback
fields, and Display API Open-ID ownership query must be revalidated or replaced
against the official Affiliate Creator Authorization documentation before use.

No schema or migration may yet assume the Affiliate creator ID format, token
fields, scope names, refresh model, token retention rules, seller-to-creator
mapping, or connection cardinality. No token exchange, account authorization,
connection creation, migration, or TikTok Shop ingestion is approved by this
planning decision.

Proposed environment namespaces are
`TIKTOK_SHOP_AFFILIATE_CREATOR_*` for the Affiliate creator app and
`TIKTOK_SHOP_SELLER_*` for the preserved Local Sellers app. Exact suffixes such
as `APP_KEY`, `CLIENT_KEY`, `APP_SECRET`, or `CLIENT_SECRET` must follow the
official documentation and may not be chosen until confirmed. The legacy
`TIKTOK_SHOP_CREATOR_AUTH_ENABLED` and `TIKTOK_SHOP_APP_KEY_SANDBOX` variables
remain unset and must not activate or supply the future Affiliate path.

## Shared Rules

- Use exact platform IDs first.
- Use normalized names only as an explicit fallback and mark those matches as lower confidence.
- Every imported row should carry `first_seen_sync_run_id` and `last_seen_sync_run_id` when it represents a durable entity.
- Every metric or financial snapshot should reference `sync_run_id`.
- The existing Display API path must continue rejecting records before `2025-10-01`.
- TikTok Shop, Creator Rewards, and TikTok GO must not inherit the Display API
  cutoff. Each future boundary requires confirmed provider availability and an
  approved exact-account source policy.
- Future source boundaries must come from an approved account/source import policy and confirmed provider availability; they must never broaden history implicitly.
- All Accounts is always calculated from account-level rows and never inserted as a creator account.
- A usable ingestion route must not be exposed until provider contracts,
  approval, persistence, rollback, reconciliation, and operational controls are
  confirmed and separately approved.
