# Northstar TikTok Shop Integration Readiness

This note belongs only to the isolated Northstar TikTok sandbox dashboard. It does not change production, deploy services, import files, or include Jennifer's private creator data.

## Integration Direction

### Current application-path decision

TikTok Shop Partner Support has confirmed that the existing **Northstar Creator
Custom / Local Sellers** app is seller-facing and cannot provide Northstar's
creator-affiliate integration. Northstar will preserve that app unchanged as an
optional dormant seller-side integration. Its seller scopes remain inactive,
and it must not be deleted, repurposed, or used by a creator-affiliate route.

Northstar's primary TikTok Shop creator integration will use a separate
**Affiliate** app registered for the Affiliate service category and United
States market. The initial development and testing app will be an Affiliate
custom app using approved Affiliate Creator API scopes and TikTok Shop Creator
Authorization. A later production/public app decision remains subject to
TikTok's approval and launch requirements.

TikTok Shop Creator Authorization is separate from TikTok for Developers Login
Kit and from TikTok for Business authorization. Northstar must therefore keep
three independent provider connections:

1. **TikTok Content API** — TikTok for Developers Login Kit and Display API;
2. **TikTok Shop Affiliate Creator** — Affiliate app, Creator Authorization,
   creator-affiliate scopes, identity, tokens, and data;
3. **TikTok Shop Seller** — the preserved Local Sellers app and any future
   seller-authorized scopes, shop identity, tokens, and data.

These providers must not share app credentials, authorization routes, provider
identity fields, scope records, token records, connection rows, refresh jobs,
or audit namespaces. They may link only through Northstar's exact internal
creator-account UUID after provider-specific ownership has been verified.

The committed TikTok Shop OAuth foundation remains disabled and dormant. It
must not authorize an account, exchange a code, obtain or refresh a token,
create a connection, run an import, or ingest TikTok Shop data until every
Affiliate Creator Authorization detail listed below has been verified against
the official documentation available to Northstar's Affiliate app.

Northstar remains one unified creator dashboard. TikTok Content and TikTok Shop can connect separately behind the scenes, but their results should flow into the existing Morning Brief, Opportunity Center, Earnings, Products, Videos, Data Hub, and Settings pages.

Phase 1 keeps the existing Display API sandbox work:

- Login Kit
- `user.info.basic`
- `user.info.stats`
- `video.list`
- profile identity, account stats, public video metadata, views, likes, comments, and shares

Phase 2 adds a separately authorized TikTok Shop Affiliate Creator connection
after the Affiliate app, exact scope inventory, and official authorization
contract are available. Any seller connection remains optional and separate.

## Data Provenance

Every real or demo metric should keep a source value:

- `tiktok_display_api`
- `tiktok_shop_affiliate_api`
- `official_tiktok_shop_report`
- `creator_rewards_source`
- `tiktok_go_source`
- `demo`

The UI can stay friendly, but Northstar must know whether a value is real, demo, estimated, settled, account-specific, and when it was synchronized.

## Dormant LIVE Shopping Boundary

The sandbox dashboard includes a LIVE section for future Creator
Collaborations/Affiliate reporting. It currently displays no fabricated creator
or sales records. The provider-neutral foundation can represent:

- exact-account LIVE sessions with start/end and replay availability;
- product-to-LIVE featured relationships;
- creator affiliate orders, units, and GMV;
- estimated and final commissions;
- refund count, refunded GMV, and refunded commission;
- sales and GMV per hour using the LIVE session duration;
- source labels for Manual, Imported, and TikTok API provenance.

Manual and Imported are model-level provenance options only. No manual-entry
form, file upload, import endpoint, writer, or persistence path exists. TikTok
API is clearly unavailable and rejected by the domain model until Northstar has
authorized Affiliate Creator API access and a separately reviewed provider
implementation. The Data Portability Full Archive is excluded.

LIVE gifts remain a separate revenue category. Gifts are not included in LIVE
Shopping affiliate GMV, orders, units, estimated/final commission, refunds, or
sales-per-hour totals.

This foundation does not collect direct messages, phone numbers, email
addresses, physical addresses, login IPs, payment details, searches, watch
history, customer-service conversations, or shopper activity. It changes no
TikTok Content API behavior, Local Sellers app behavior, OAuth flow, production
data, database schema, or migration.

## Total Earnings Recommendation

Default Total Earnings should be Estimated Earnings for the selected period, from connected real revenue sources only:

- TikTok Shop estimated commission
- Creator Rewards
- TikTok GO
- future configured revenue sources

Settled Earnings should remain a separate view or filter. Pending commission, refund adjustments, organic commission, and Shop Ads commission should be kept separately when a source supplies those fields.

If only TikTok Content is connected, Total Earnings should show `$0` or a clean "No real revenue source connected yet" state. Demo values must not be blended into live totals.

## Official TikTok Shop API Findings

Official TikTok Shop Partner Center documentation indicates that affiliate APIs are separate from the Display API. Affiliate API access is inactive by default and requires partner/ISV approval. Creator authorization is separate from seller authorization.

Important documented signals:

- Affiliate integration requires a Partner Center setup, app/service creation, compliance review for public apps, and approval from a Partner Manager or Account Manager before Affiliate APIs are active.
- Creator authorization uses a creator authorization link and a required `state` parameter. The authorization code is exchanged for a creator access token.
- `Search Creator Affiliate Orders` exists under required scope `creator.affiliate_collaboration.read` and returns affiliate order/product data for creator-generated affiliate conversions.
- `Creator Search Open Collaboration Product` exists under required scope `creator.affiliate_collaboration.read` and searches open-collaboration products by category, commission rate, keywords, and sortable fields.
- `Get Showcase Products` exists under required scope `creator.showcase.read` or `creator.video.write`; it returns products in a creator showcase and supports pagination.
- Creator sample application detail is documented under the creator affiliate collaboration scope, but Northstar should still verify whether the approved app can retrieve the exact sample statuses Jennifer needs before treating sample workflow data as live.
- Some seller analytics/product-video performance APIs require seller-side authorization and TikTok Shop Analytics scopes, so they should not be assumed available to Jennifer's creator account until Partner Center access confirms it.
- Open collaboration setup in Seller Center supports standard commission and Shop Ads commission settings, but seeing those values in UI does not automatically prove creator-side API availability.

Unknown until the Affiliate app and its exact official documentation are available:

- Whether Jennifer's real creator account can connect through the creator authorization flow for this app.
- Exact creator-side historical limits for orders, products, commission, settlements, and attribution.
- Whether official creator APIs expose organic video vs Shop Ads attribution in the exact form Northstar needs.
- Whether refunds, settlement dates, commission rate changes, and video IDs are consistently available for creator-side order records.

Official references checked:

- TikTok Display API overview: https://developers.tiktok.com/doc/display-api-overview/
- TikTok Shop API Affiliate Orders: https://partner.tiktokshop.com/docv2/page/search-creator-affiliate-orders
- TikTok Shop API Showcase Products: https://partner.tiktokshop.com/docv2/page/get-showcase-products
- TikTok Shop API Open Collaboration Products: https://partner.tiktokshop.com/docv2/page/creator-search-open-collaboration-product
- TikTok Shop creator authorization guide: https://partner.tiktokshop.com/docv2/page/creator-authorization-guide

## Resolved Application-Path Inquiry

Partner Support confirmed the application path: the Local Sellers app is
seller-facing, while Northstar's primary creator integration requires a separate
Affiliate app, Affiliate service category, United States market, Affiliate
Creator API scopes, and TikTok Shop Creator Authorization. The Local Sellers app
remains unchanged as optional dormant seller infrastructure.

Still pending are the exact scope inventory granted to the Affiliate custom app,
the official Creator Authorization contract for that app, test-account rules,
United States availability constraints, and the production/public-app approval
path.

## Committed OAuth Foundation Audit

### Provider-neutral components to retain

- cryptographically secure opaque state generation;
- SHA-256 state-keying so raw state is not stored server-side;
- a 600-second TTL and collision-safe `SET ... NX` issuance;
- atomic read-and-delete consumption for one-time use across serverless instances;
- replay, expiration, malformed-record, environment, purpose, and session checks;
- exact Northstar creator-account UUID validation and rejection of calculated
  All Accounts identities;
- fail-closed feature and sandbox-environment guards;
- GET-only method restrictions, controlled error responses, no-store headers,
  and redaction of state/provider values;
- dependency-injected tests for storage, routing, disabled behavior, failures,
  and the terminal no-token-exchange callback.

The state record's provider and purpose constants must be renamed to an explicit
Affiliate Creator namespace before activation. The security mechanics can be
retained.

### Affiliate assumptions requiring official revalidation

The following committed details are not approved Affiliate contracts and must
not be activated as-is:

- authorization URL, including its host and path;
- every required authorization parameter and its exact name, encoding,
  cardinality, and signing rule;
- whether TikTok calls the public app identifier `app_key`, `client_key`, or
  another documented name, and which credential class is required;
- callback method, required and optional query parameters, denial/error fields,
  authorization-code field, duplicate-parameter behavior, and redirect-URI
  matching rules;
- token-exchange endpoint, HTTP method, authentication method, request and
  response fields, expiry semantics, and safe error model;
- Affiliate creator identity, including the meaning and stability of Creator
  Open ID and whether it is distinct from the Display API Open ID;
- exact Affiliate Creator scope names and which endpoints each scope authorizes;
- refresh-token availability, rotation, reuse/revocation behavior, lifetime,
  and recovery requirements;
- token encryption, storage, access-control, retention, deletion, and audit
  requirements;
- the official method for proving that the authorized Affiliate creator belongs
  to the exact Northstar creator account;
- market, custom-app, test-account, allowlist, review, and approval constraints.

The current start route incorrectly uses the existing TikTok Content connection's
Display API Open ID as its ownership prerequisite. That is safe while disabled
but is not a valid Affiliate identity design. Future code must bind the
Northstar session and exact account first, then verify and attach the returned
Affiliate creator identity without assuming equality with any Display API or
seller identity.

### Planned implementation impact

After the Affiliate app and exact scope inventory are available, Northstar
should selectively revise the dormant foundation rather than extend the seller
app path:

- rename routes, constants, state keys, source/status values, and tests to an
  explicit `tiktok_shop_affiliate_creator` provider namespace;
- replace the authorization URL builder and callback parser only with confirmed
  official Affiliate Creator Authorization values;
- remove the Display API Open-ID prerequisite and add an independently verified
  Affiliate creator ownership/identity binding;
- design a separate encrypted token store and connection record for Affiliate
  creator credentials only after storage and refresh requirements are confirmed;
- add token exchange and refresh behavior only under separate approval, with no
  ingestion implied by successful authorization;
- reserve a different route, credential, identity, token, scope, and connection
  namespace for any future Local Sellers integration;
- keep the existing TikTok Content Login Kit routes and connection records
  unchanged.

Until then, retain the committed code dormant because its state, replay, and
fail-closed controls are reusable. Revise the provider-specific URL, parameter,
identity, and naming portions before any enablement. Remove the dormant routes
only if official Affiliate documentation proves that their transport or state
model is incompatible; no removal is currently required.

Proposed future environment-variable names, with no values committed or set:

- `TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED`
- `TIKTOK_SHOP_AFFILIATE_CREATOR_APP_KEY_SANDBOX` or the exact credential term
  used by official Affiliate documentation
- `TIKTOK_SHOP_AFFILIATE_CREATOR_APP_SECRET_SANDBOX` only if the official token
  exchange requires it
- `TIKTOK_SHOP_AFFILIATE_CREATOR_REDIRECT_URI_SANDBOX`
- separate `TIKTOK_SHOP_SELLER_*` names for any future Local Sellers path

The current `TIKTOK_SHOP_CREATOR_AUTH_ENABLED` and
`TIKTOK_SHOP_APP_KEY_SANDBOX` names should remain unset and be deprecated or
replaced during the reviewed Affiliate implementation, never silently reused.

## Field Capability Matrix

| Area | Field | Status |
| --- | --- | --- |
| Products | Product ID | Officially available for approved Shop affiliate/product endpoints |
| Products | Title | Officially available for approved product/showcase endpoints |
| Products | Image | Requires approval; likely product/showcase dependent |
| Products | Product URL | Requires approval; promotion-link/product endpoints may provide links |
| Products | Showcase status | Requires approval; showcase endpoints are documented |
| Products | Seller/shop | Requires approval; seller/creator authorization context dependent |
| Products | Standard commission rate | Requires approval; documented in collaboration/search contexts |
| Products | Shop Ads commission rate | Visible in TikTok UI but API access unconfirmed for creator-side use |
| Products | Sample status | Requires approval; creator sample detail endpoint is documented, exact workflow coverage pending access |
| Products | Units sold | Requires approval; endpoint/report dependent |
| Products | GMV | Requires approval; endpoint/report dependent |
| Products | Product commission | Requires approval; endpoint/report dependent |
| Orders | Order ID | Officially available through approved creator affiliate orders |
| Orders | Product ID | Officially available through approved creator affiliate orders |
| Orders | Content/video ID | Unknown pending Partner Center access |
| Orders | Order date | Requires approval; expected on order search results |
| Orders | Quantity | Requires approval; endpoint/report dependent |
| Orders | Item price | Requires approval; endpoint/report dependent |
| Orders | GMV | Requires approval; endpoint/report dependent |
| Orders | Order status | Requires approval; endpoint/report dependent |
| Orders | Refund status | Unknown pending Partner Center access |
| Orders | Estimated commission | Requires approval; endpoint/report dependent |
| Orders | Settled commission | Unknown pending Partner Center access |
| Orders | Commission rate | Requires approval; endpoint/report dependent |
| Orders | Attribution source | Unknown pending Partner Center access |
| Orders | Settlement date | Unknown pending Partner Center access |
| Attribution | Organic video | Unknown pending Partner Center access |
| Attribution | Shop Ads | Visible in TikTok UI but API access unconfirmed |
| Attribution | LIVE | Unknown pending Partner Center access |
| Attribution | Showcase | Unknown pending Partner Center access |
| Attribution | Other official sources | Unknown pending Partner Center access |
| Earnings | Estimated | Requires approval or official report import |
| Earnings | Settled | Unknown pending Partner Center access |
| Earnings | Pending | Unknown pending Partner Center access |
| Earnings | Available | Unknown pending Partner Center access |
| Earnings | Daily earnings | Requires approval or official report import |
| Earnings | Earnings by product | Requires approval or official report import |
| Earnings | Earnings by video | Unknown pending Partner Center access |
| Earnings | Earnings by account | Officially available inside Northstar once imported by account |
| Earnings | Refund adjustments | Unknown pending Partner Center access |

## Official Report Import Fallback

If Shop API approval is not available immediately, Northstar should support an official report-import path.

Allowed source:

- CSV or spreadsheet exports Jennifer manually downloads from TikTok Shop Creator Center, Affiliate Center, or other official TikTok Shop reporting surfaces.

Not allowed:

- scraping
- browser automation against TikTok UI
- session-cookie reuse
- undocumented endpoints

CSV adapter design:

- account selector before import
- file type and header validation
- preview before save
- missing-column warnings
- duplicate detection by source file, account, product ID, order ID, date, and video ID when present
- re-import safety through import batch IDs
- import summary with added, updated, skipped, and error rows
- error-row export
- source set to `official_tiktok_shop_report`
- never overwrite Display API videos unless an exact TikTok video ID matches

Exact report names, export paths, and column lists must be confirmed from Jennifer's available TikTok Shop Creator Center once she has access. No report has been imported in this sandbox step.

## Unified Data Models

### ConnectedAccount

- `internalAccountId`
- `platform`
- `openId`
- `displayName`
- `username`
- `avatarUrl`
- `followerCount`
- `videoCount`
- `connectedAt`
- `lastSyncAt`

### PublicVideo

- `internalVideoId`
- `tiktokVideoId`
- `internalAccountId`
- `title`
- `description`
- `coverImageUrl`
- `shareUrl`
- `createTime`
- `viewCount`
- `likeCount`
- `commentCount`
- `shareCount`
- `syncedAt`

### AffiliateProduct

- `internalProductId`
- `platformProductId`
- `internalAccountId`
- `title`
- `imageUrl`
- `productUrl`
- `showcaseStatus`
- `standardCommissionRate`
- `shopAdsCommissionRate`
- `units`
- `gmv`
- `estimatedCommission`
- `settledCommission`
- `syncedAt`

### AffiliateOrder

- `internalOrderId`
- `platformOrderId`
- `internalAccountId`
- `platformProductId`
- `platformVideoId`
- `orderDate`
- `quantity`
- `itemPrice`
- `gmv`
- `orderStatus`
- `refundStatus`
- `attributionType`
- `commissionRate`
- `estimatedCommission`
- `settledCommission`
- `settlementDate`
- `syncedAt`

### DailyRevenue

- `internalAccountId`
- `date`
- `revenueSource`
- `estimatedEarnings`
- `settledEarnings`
- `pendingEarnings`
- `gmv`
- `units`
- `source`
- `syncedAt`

Only attribution enums confirmed in official documentation or official report columns should be stored as canonical values.

## Database Recommendation

Recommended provider: Supabase.

Database type: managed PostgreSQL.

Sandbox database name: `northstar_sandbox`.

Future production database name: `northstar_production`.

Core tables:

- `accounts`
- `connected_accounts`
- `public_videos`
- `affiliate_products`
- `affiliate_orders`
- `daily_revenue`
- `import_batches`
- `import_errors`
- `sync_runs`
- `source_snapshots`

Unique keys:

- `connected_accounts(platform, open_id)`
- `public_videos(platform, tiktok_video_id)`
- `affiliate_products(platform, platform_product_id, internal_account_id)`
- `affiliate_orders(platform, platform_order_id, internal_account_id)`
- `daily_revenue(internal_account_id, date, revenue_source, source)`
- `import_batches(source, source_file_hash, internal_account_id)`

Relationships:

- each `public_video` belongs to one `connected_account`
- each `affiliate_product` belongs to one `connected_account`
- each `affiliate_order` belongs to one `connected_account`
- each `affiliate_order` optionally links to one `affiliate_product` and one `public_video`
- `daily_revenue` aggregates orders and earnings by account/date/source

Deduplication strategy:

- videos match only by TikTok video ID
- products match by platform product ID first, normalized product name only as fallback during reviewed imports
- orders match by platform order ID
- report imports store a batch hash and row hash so the same report can be re-imported safely

Clean-start verification:

- create empty sandbox database
- confirm row counts are zero before first sync/import
- import one small verified report or connect one Sandbox account
- compare totals against the source preview before accepting

Backup strategy:

- daily managed database backups once production begins
- export before schema migrations
- retain import files outside the database with hashes only
- keep rollback scripts for migrations

Estimated initial cost:

- Supabase free tier may be enough for sandbox and early testing.
- Production should budget for the first paid tier once historical order/video data and backups matter.

Why PostgreSQL is preferable to Redis for permanent commerce data:

- relational joins between videos, products, orders, accounts, and daily revenue
- unique constraints for duplicate prevention
- historical queries and date filters
- safer migrations and backups
- better auditability for source and sync timestamps

Upstash Redis remains appropriate for OAuth/session/token state only, not permanent commerce history.
