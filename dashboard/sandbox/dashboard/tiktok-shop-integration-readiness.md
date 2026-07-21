# Northstar TikTok Shop Integration Readiness

This note belongs only to the isolated Northstar TikTok sandbox dashboard. It does not change production, deploy services, import files, or include Jennifer's private creator data.

## Integration Direction

Northstar remains one unified creator dashboard. TikTok Content and TikTok Shop can connect separately behind the scenes, but their results should flow into the existing Morning Brief, Opportunity Center, Earnings, Products, Videos, Data Hub, and Settings pages.

Phase 1 keeps the existing Display API sandbox work:

- Login Kit
- `user.info.basic`
- `user.info.stats`
- `video.list`
- profile identity, account stats, public video metadata, views, likes, comments, and shares

Phase 2 adds TikTok Shop when approved, or uses an official TikTok Shop report import while API approval is pending.

## Data Provenance

Every real or demo metric should keep a source value:

- `tiktok_display_api`
- `tiktok_shop_affiliate_api`
- `official_tiktok_shop_report`
- `creator_rewards_source`
- `tiktok_go_source`
- `demo`

The UI can stay friendly, but Northstar must know whether a value is real, demo, estimated, settled, account-specific, and when it was synchronized.

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

Unknown until Partner Center access:

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
