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

## Affiliate Creator Authorization Credentials (Migration 005, Applied and Validated in Sandbox)

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
baseline, and October 1, 2025 Display API cutoff. The final physical-name
safeguard validation confirmed both lifecycle CHECK constraints are present
once, validated, and definition-matched; the lifecycle trigger is present once
and structurally matched; the Affiliate Creator control-plane baseline remains
empty; and the Display boundary remains unchanged (`validation_passed = true`).
The helper's 10-versus-9 field expectation was a local result-shape defect only
and did not require a rerun. Migration 006 was not executed and no database
repair is required. Earlier missing-object results were untruncated-name lookup
defects, not schema defects. Migration 005 does not change Display API routes,
existing Content authorization, or the October 1, 2025 Display API cutoff.

## Affiliate Creator Authorization Safeguard Compatibility (Migration 006, Local and Unexecuted)

Migration `006_repair_affiliate_creator_authorization_safeguards.sql` is now a
transactional, validation-only compatibility record. It performs no repair DDL
or data change. It fails closed unless the Migration 005 safeguards exist once
at these PostgreSQL 63-byte physical names, on the intended relation, with their
validated/exact CHECK definitions and exact enabled user-defined `BEFORE UPDATE`
row-trigger structure:

- `affiliate_creator_connections_authorization_timestamp_order_che`
- `affiliate_creator_connections_authorization_state_timestamps_ch`
- `affiliate_creator_connections_authorization_lifecycle_forward_o`

It adds no role, grant, default privilege, route, flag, token, writer, provider
request, or data row. It does not instruct execution of obsolete repair DDL and
preserves the controlled erasure boundary and all existing PUBLIC revocations.

## Affiliate Creator Authorization Persistence Functions (Migration 007, Applied and Dormant)

Migration `007_affiliate_creator_authorization_persistence_functions.sql` is a
transactional writer boundary. It creates exactly four
`SECURITY DEFINER` functions, each with the fixed search path `pg_catalog,
public, pg_temp` and an exact `PUBLIC` execute revocation: authorization
finalization, refresh credential replacement, invalid-refresh cleanup, and
deauthorization. No application role is granted execution and no direct table
privilege, route, feature flag, runtime writer, token exchange, or provider
activity is added.

The migration fails closed unless Migration 005's connection, ciphertext-only
credential, and append-only authorization-event relations are present; its
physical 63-byte lifecycle safeguard names are validated; required trigger
functions and existing PUBLIC revocations remain intact; and the Affiliate
Creator connection, credential, and event tables are empty. The controlled
erasure function remains unchanged and ungranted.

Each function locks one exact connection/account/provider row `FOR UPDATE` and
requires compare-and-swap authorization and credential revisions. Finalization
from `callback_received` inserts only a current access/refresh AES-256-GCM
envelope pair and appends `token_validated`. Refresh from `refresh_required`
updates both current envelope rows in place (no ciphertext history) and appends
`refresh_succeeded`. Invalid refresh deletes the pair, transitions to
`reauthorization_required`, and appends `refresh_failed`. Deauthorization
deletes the pair, sets the legacy state to `revoked`, transitions to
`deauthorized`, and appends `all_access_removed`. All errors are stable,
identifier-free codes; events contain no provider error or credential data.

Migration 007 was applied once to the sandbox only after a verified-TLS
preflight. Its read-only post-validation passed: all four exact functions are
present with their intended security and ACL boundary, the M005 safeguards and
Display boundary remain intact, and the Affiliate Creator baseline is empty.
The functions remain dormant and ungranted; this record does not activate a
runtime writer, authorization exchange, provider request, or route.

## Affiliate Creator Runtime Privileges (Migration 008, Local and Unexecuted)

Migration `008_affiliate_creator_runtime_privileges.sql` is a dormant,
transactional privilege boundary for one separately provisioned exact runtime
role, `northstar_affiliate_creator_runtime`. It never creates, alters,
credentials, or grants membership to that role. Before any grant, it fails
closed unless the role can log in, is `NOINHERIT`, owns no relevant object, has
no default privileges or existing direct access, and has none of the
superuser, database-creation, role-creation, replication, or BYPASSRLS
attributes. PostgreSQL 18 implicitly gives the provisioning `SESSION_USER` one
inbound administrator relationship on a newly created role; the migration
accepts only that exact `ADMIN OPTION` row with neither `INHERIT OPTION` nor
`SET OPTION`, rejects all outbound memberships, and rejects every additional
or unrelated inbound membership. This administrative relationship does not
confer runtime privilege inheritance. Before any grant, the guard reads only
the exact role's `pg_authid.rolpassword IS NULL` predicate; it never reads or
exposes a password value and fails closed if that catalog predicate cannot be
validated.

The migration grants only `USAGE` on `public` and `EXECUTE` on the four exact
Migration 007 `SECURITY DEFINER` signatures. It grants no direct table,
sequence, credential, event, erasure-function, schema-creation, broad
function, grant-option, or PUBLIC privilege. Its postcheck rejects every
effective direct grant outside that exact set and preserves the existing
ungranted controlled-erasure boundary. It remains unexecuted until private
provider approval separately provisions the exact role and authorizes the
database change; no runtime code, route, token flow, or provider action is
activated by this plan.

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

## Affiliate Creator single-account authorization boundary (Migration 009)

Migration 009 is a dormant database-only authorization boundary. It binds the
validated `northstar_affiliate_creator_runtime` role OID to exactly one
Affiliate Creator account and provider. The binding cascades when the controlled
account-erasure path removes that account; the runtime role receives no direct
access to the binding or authorization-state relations.

The boundary derives account identity from `SESSION_USER`, never from a
runtime-supplied account ID or `CURRENT_USER`. PostgreSQL 18 documents that
`SESSION_USER` remains the real/original login identity while `CURRENT_USER` is
the effective permission identity and changes under a `SECURITY DEFINER`
function. The validated runtime role is `NOSUPERUSER`, so it cannot substitute
another session identity. The two runtime functions therefore use a fixed
search path and fail closed unless `SESSION_USER` resolves to the exact runtime
role and its sole binding.

The ungranted administrative binder verifies the runtime role's least-privilege
attributes, NULL password, and PostgreSQL 18 creator-admin membership model
before creating the single account binding. Public execution is revoked from
every new function; only the runtime role receives EXECUTE on the two
authorization-control functions.

Authorization state stores only an internal connection/account binding, fixed
provider, monotonic authorization revision, strict 64-character lowercase
hexadecimal digest, and expiry metadata. It stores no raw state, authorization
code, token, app credential, encryption key, Open ID, redirect URL, callback
payload, or provider error. A successful callback atomically deletes its exact
state row, then advances from `authorization_pending` to `callback_received`.
Migration 005's trigger remains the source of event sequencing: Migration 009
supplies its required `event_sequence = 0` sentinel for `authorization_started`
and `callback_accepted` events.

## Affiliate Creator runtime persistence boundary (Migration 010)

Migration 010 adds the sole runtime entry point for initial credential
persistence. It accepts no account ID: it resolves the bound account only from
`SESSION_USER` and Migration 009's exact runtime-role binding, then verifies
the callback lifecycle state and revisions before delegating to Migration 007's
atomic persistence function. The wrapper is `SECURITY DEFINER` with a fixed
search path, has PUBLIC execution revoked, and is the sole initial-persistence
entry point granted by this migration. The former direct runtime grant on
the account-id persistence function is revoked, preventing account identity
from being supplied by a runtime caller. It stores only the pre-encrypted
envelope fields accepted by Migration 007; plaintext credentials, codes, and
provider payloads remain outside this database boundary.

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
