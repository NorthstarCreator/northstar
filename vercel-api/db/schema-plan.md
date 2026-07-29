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

## Shared Rules

- Use exact platform IDs first.
- Use normalized names only as an explicit fallback and mark those matches as lower confidence.
- Every imported row should carry `first_seen_sync_run_id` and `last_seen_sync_run_id` when it represents a durable entity.
- Every metric or financial snapshot should reference `sync_run_id`.
- The existing Display API path must continue rejecting records before `2025-10-01`.
- Future source boundaries must come from an approved account/source import policy and confirmed provider availability; they must never broaden history implicitly.
- All Accounts is always calculated from account-level rows and never inserted as a creator account.
