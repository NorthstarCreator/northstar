# Northstar Beta 2 TikTok Sandbox Dashboard

This folder is the isolated Beta 2 dashboard shell prepared for TikTok Developer Sandbox testing.

## Safety

- Demo data remains available for unsupported commerce and planning areas.
- Live TikTok Display API data appears only after Sandbox OAuth authorization.
- TikTok OAuth starts from the secure sandbox API connector, not from frontend secrets.
- No credentials.
- No production dashboard domain.
- No production API domain.
- No production TikTok credentials.
- No Jennifer private local app data.
- No localStorage exports, backups, sales records, notes, samples, or personal data.

## Open Locally

Double-click:

`dashboard/sandbox/dashboard/index.html`

The prototype works directly from `file://`.

When opened locally, the dashboard shows demo data unless the sandbox API is available at:

`https://sandbox-api.northstar-creator.com`

## Included Screens

- Morning Brief
- Audience
- View Performance
- Opportunity Center
- Earnings
- Products
- Product Workspace
- Videos
- Video Detail
- Data Hub
- Settings

## TikTok Sandbox Test URLs

Recommended isolated test surfaces:

- Dashboard: `https://sandbox-app.northstar-creator.com`
- API: `https://sandbox-api.northstar-creator.com`
- OAuth callback: `https://sandbox-api.northstar-creator.com/auth/tiktok/callback`
- Allowed frontend origin: `https://sandbox-app.northstar-creator.com`

The dashboard reads only public configuration from `config.js`.

## Approved Initial Scopes

This sandbox shell is limited to:

- `user.info.basic`
- `user.info.stats`
- `video.list`

It does not request TikTok Shop data, sales, samples, commissions, orders, posting, uploads, Share Kit, TikTok GO, Creator Rewards, webhooks, demographics, or audience active-time data.

## Live Data Mapping

When a Sandbox account is authorized, live Display API data can populate:

- Account selector identity and avatar
- Morning Brief follower, like, and public-video signals
- Audience profile statistics
- Videos list
- Video detail
- Last Sync status

TikTok Content and TikTok Shop are intentionally separate connection cards in Data Hub:

- TikTok Content uses Login Kit and Display API scopes for profile, stats, and public videos.
- TikTok Shop is awaiting approved Affiliate API access or official report import.
- Connecting TikTok Content does not mark TikTok Shop connected.
- Total Earnings uses connected real revenue sources only once a live account is connected.
- Demo Shop, Creator Rewards, and TikTok GO values stay labeled as demo and are excluded from live earnings totals.

Unsupported sections remain visibly demo-labeled or show an awaiting-real-source state.

## Source Policy

Northstar keeps data provenance on every real or demo source:

- `tiktok_display_api`
- `tiktok_shop_affiliate_api`
- `official_tiktok_shop_report`
- `creator_rewards_source`
- `tiktok_go_source`
- `demo`

Upstash Redis is used only for OAuth/session/token state. Permanent commerce data should move to a relational database once TikTok Shop or official report imports are enabled.

## Demonstrated Interactions

- Sidebar navigation
- Account switching
- Date filtering
- Custom date range
- Earnings-source filtering
- Product detail navigation
- Video detail navigation
- Product video sorting
- Mock content generation
- Add Account mock modal
- Add Revenue Source mock modal
- Connect TikTok Sandbox
- Sync Now
- Disconnect TikTok

## Notes

This prototype is intentionally calm, compact, and non-technical. It is designed for isolated TikTok Sandbox review before any production integration work.

For TikTok Shop readiness, see `tiktok-shop-integration-readiness.md`.
