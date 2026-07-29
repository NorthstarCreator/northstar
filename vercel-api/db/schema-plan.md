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
