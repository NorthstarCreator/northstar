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
Migration 003 was applied to the NorthStar sandbox and passed its separately
approved read-only post-migration validation. It remains schema-only and contains
no policy rows.

## Affiliate Creator Import Control (Migration 004, Applied and Validated in Sandbox)

Migration `004_affiliate_creator_import_control.sql` is the proposed first Phase
3 persistence checkpoint. It depends on migration 003 and fails before making
changes when `source_import_policies` is absent. Migrations 003 and 004 were
applied to the NorthStar sandbox through separately approved operations and each
passed its independently approved read-only validation. The migration 004
post-application result reported `validation_passed = true`. It does not modify
migrations 001-003 and contains no seed or provider data.

The migration extends the policy vocabulary with the explicit
`tiktok_shop_affiliate_creator` source and the creator-facing `start_date` mode.
It stores the selected local date separately from the calculated UTC boundary.
An Affiliate Creator `start_date` policy requires a local date and an effective
UTC start; `all_available` requires both to remain null. No date is a schema
default. Jennifer's October 1, 2025 choice is therefore one future creator-
account policy and cannot restrict another creator or become the Display API
cutoff for Affiliate data.

The migration defines six control-plane tables:

- `affiliate_creator_connections`: exact account/provider identity metadata,
  authorization state, allowlisted granted-scope names, and expiration metadata.
  It has no credential, authorization-code, access-token, refresh-token, signed-
  URL, or secret column and defaults to `disabled`.
- `affiliate_creator_import_runs`: an exact account, connection, approved policy,
  deterministic idempotency key, creator-local policy choice, immutable half-open
  UTC window, first-import review state, sanitized failure codes, and
  reconciliation totals.
- `affiliate_creator_import_pages`: account/run-scoped operation and page-number
  progress, SHA-256 request/cursor hashes, safe status, and per-page totals. Raw
  cursors, request identifiers, response bodies, and provider payloads are not
  stored.
- `affiliate_creator_import_run_events`: bounded, append-only lifecycle events
  with exact account/run identity and sanitized machine status codes.
- `affiliate_creator_account_erasure_authorizations`: transaction-local control
  records used only by the controlled account-erasure function. PUBLIC receives
  no table privileges.
- `affiliate_creator_account_erasure_receipts`: immutable, non-identifying
  deletion-count receipts without creator-account identity.

Composite foreign keys carry `account_id` through policy, connection, run, page,
and event relationships so records from two creator accounts cannot be joined.
The existing `creator_accounts` UUID foreign key and alias constraint keep All
Accounts calculated only. Run identity, account, policy, connection, range,
timezone, first-import designation, idempotency key, and UTC boundaries are
immutable after insertion.

Migration 004 adds no route, repository, writer, queue, HTTP client, OAuth/token
behavior, commerce entity, revenue ledger, environment variable, feature
activation, or migration runner. All six Affiliate Creator control-plane tables
were empty at validation. The integration remains inactive, no application role
has been granted access, and no token exchange, token storage, authorization,
import, or TikTok action has occurred through this foundation. Affiliate Creator
authorization remains disabled and separate from the existing TikTok Content
authorization flow.

All seven migration functions use the fixed function-level search path
`pg_catalog, public, pg_temp`, and migration-owned relation references are schema
qualified. PUBLIC execution is explicitly revoked from every function. The six
trigger functions are callable only through their table triggers. The controlled
erasure function is `SECURITY DEFINER` and remains ungranted to every application
role pending a separate destructive-operation approval. It was not invoked
during migration execution or validation.

### Migration 004 role and grant matrix

| Object class | Owner/executor requirement | PUBLIC | Application roles |
| --- | --- | --- | --- |
| Six control tables | Migration owner retains ownership | No new privileges; erasure authorization table explicitly revoked | None granted by migration 004 |
| Six trigger functions | Migration owner creates functions and triggers | `EXECUTE` explicitly revoked | No direct grant; trigger invocation only |
| `erase_affiliate_creator_control_data(uuid,text,text)` | Migration owner only pending a separately approved erasure role | `EXECUTE` explicitly revoked | **No grant** |

PostgreSQL 18 represents table `NOT NULL` constraints in `pg_constraint` with
`contype = 'n'`. Migration validation must count primary, unique, foreign-key,
and check constraints with `contype IN ('p','u','f','c')` and audit `n`
constraints separately; it must not compare an unfiltered total constraint count.

## Affiliate Creator Authorization Credentials (Migration 005, Applied in Sandbox; Safeguard Repair Pending)

Migration `005_affiliate_creator_authorization_credentials.sql` depends on the
validated Migration 004 control plane. It was applied to the NorthStar sandbox
through a separately approved operation. It fails closed if Migration 004 control relations are absent, a
calculated All Accounts alias is present, a pre-existing connection would need
legacy interpretation, or its own relations already exist. It creates no rows,
grants, routes, flags, writers, encryption implementation, credentials, or
provider activity.

It adds a separate eight-state Affiliate Creator authorization lifecycle to
`affiliate_creator_connections`: `not_authorized`, `authorization_pending`,
`callback_received`, `authorized_limited`, `authorized_ready`,
`refresh_required`, `reauthorization_required`, and `deauthorized`. The legacy
connection `state` remains untouched. Authorization and credential revisions
start at zero; a forward-only trigger rejects regressive lifecycle and revision
updates. Authorized states require the validated creator identity facts already
modeled by Migration 004, a creator user type, validation and expiry timestamps,
and the required `creator.affiliate.info` scope.

The proposed credential relation stores only a bounded AES-256-GCM envelope:
version, algorithm, key reference, AAD version, initialization vector,
ciphertext, and authentication tag. It contains no plaintext credential,
authorization code, token column, provider response, or raw request data. Its
composite foreign key carries the exact connection, account, and Affiliate
Creator provider identity. Encryption, key management, authorization exchange,
and storage writers are deliberately outside this migration and remain disabled.

The proposed authorization-event relation is account-scoped, append-only, and
limited to lifecycle event names, state, revision, timestamp, and a sanitized
machine status code. A controlled account erasure updates the existing erasure
function without granting it: it deletes authorization events and ciphertext
envelopes only after its exact-account/transaction gate, and records only
non-identifying deletion counts in the existing immutable receipt. PUBLIC is
explicitly revoked from the new tables and functions; the replacement
`erase_affiliate_creator_control_data(uuid,text,text)` remains ungranted to
application roles and uninvoked.

Migration 005's independently approved post-validation confirmed its new
relations, encryption-envelope structure, PUBLIC revocations, existing Display
baseline, and October 1, 2025 Display API cutoff, but did not pass overall. A
catalog diagnostic identified two missing authorization timestamp CHECK
constraints and the authorization lifecycle trigger. Migration 006 is a
separately reviewed, forward-only repair for only those three missing
safeguards; it must remain unexecuted until its own preflight and execution
approval. Migration 005 does not change Display API routes, existing Content
authorization, or the October 1, 2025 Display API cutoff.

## Affiliate Creator Authorization Safeguard Repair (Migration 006, Local and Unexecuted)

Migration `006_repair_affiliate_creator_authorization_safeguards.sql` is a
non-idempotent, transactional forward repair for an otherwise committed
Migration 005 schema. It requires the exact M005 relation, columns, six existing
validated authorization CHECK constraints, all prerequisite functions, the
erasure-function PUBLIC-execution revocation, and an empty Affiliate Creator
control plane. It fails if either target constraint or the target trigger is
already present, so it cannot silently replace or broaden a safeguard.

The repair adds only these M005 definitions, verbatim: the validated
`affiliate_creator_connections_authorization_timestamp_order_check`, the
validated `affiliate_creator_connections_authorization_state_timestamps_check`,
and the enabled `BEFORE UPDATE`
`affiliate_creator_connections_authorization_lifecycle_forward_only` trigger
bound to `validate_affiliate_creator_authorization_transition()`. It adds no
role, grant, default privilege, route, flag, token, writer, provider request, or
data row, and it preserves the controlled erasure boundary and all existing
PUBLIC revocations.

The next planned migrations remain separate:

1. typed Affiliate Creator products, collaborations, samples, orders, and order
   items;
2. the canonical immutable revenue-event ledger only after money and event
   semantics are confirmed;
3. controlled first-import approval, visibility, rollback, and account-erasure
   functions after the complete entity graph is reviewable.

Future financial columns are designed as nullable signed `bigint` minor units
paired with an ISO currency code and initially constrained to USD for the U.S.
integration. No provider money string will be converted or persisted in those
columns until TikTok documents its amount format, currency guarantees, minor-
unit rules, commission finality, refund/reversal identity, and settlement
semantics. Missing or unconfirmed amounts remain null and never become zero.

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

The applied and validated migration `003_source_import_policies.sql` remains
unchanged and contains no policy rows. These planned tables are not part of
migration 003 and have not been migrated.

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
