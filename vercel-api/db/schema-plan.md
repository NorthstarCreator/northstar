# NorthStar Future Schema Plan

This document is intentionally planning-only. It defines the next schema areas without
creating commerce ingestion, seed data, mock data, sandbox data, or local-browser data.

## Future Commerce Tables

- `products`: TikTok product IDs, account ownership, seller/brand, category, product image, price, status, and first/last sync provenance.
- `video_products`: many-to-many relationship between `videos` and `products`, unique by `video_id` and `product_id`.
- `orders`: order-level records when a platform provides durable order IDs.
- `sales_daily`: daily aggregated product/video sales when order-level records are unavailable.
- `refunds`: refund records tied to orders, products, videos, or daily sales aggregates.
- `samples`: product sample lifecycle records tied to account and product when identifiers are available.
- `creator_rewards_daily`: daily Creator Rewards earnings by account and, when available, video.
- `tiktok_go_rewards_daily`: daily TikTok GO earnings by account, campaign, and content when available.
- `csv_import_batches`: uploaded file metadata, file hash, source type, account, row counts, and import status.
- `csv_import_rows`: per-row validation status, detected duplicates, matched entity IDs, and safe errors.
- `external_revenue_events`: non-TikTok revenue sources for future unified earnings reporting.

## Shared Rules

- Use exact platform IDs first.
- Use normalized names only as an explicit fallback and mark those matches as lower confidence.
- Every imported row should carry `first_seen_sync_run_id` and `last_seen_sync_run_id` when it represents a durable entity.
- Every metric or financial snapshot should reference `sync_run_id`.
- Production must reject or skip records before `2025-10-01`.
- All Accounts is always calculated from account-level rows and never inserted as a creator account.
