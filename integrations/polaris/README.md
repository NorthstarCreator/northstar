# Project Polaris

Polaris is Northstar's data update pipeline. It prepares the app for one-click creator data refreshes while keeping the current local-only app honest: Northstar is API-ready, but not API-connected yet.

## Files

- `polaris.js` is the orchestration layer. It checks sources, captures available local data, normalizes records, validates them, creates snapshots, detects changes, writes sync history, and returns a result for the Morning Brief.
- `adapters.js` holds source adapters for TikTok Studio, TikTok Shop, Creator Rewards, CSV Import, Screenshot OCR, Manual Capture, future Instagram, future YouTube, and future Amazon.
- `normalizer.js` converts incoming records into Northstar standard objects.
- `validators.js` checks missing fields, invalid numbers, duplicates, and suspicious values.
- `sync-history.js` tracks every update attempt in browser localStorage.

## Standard Northstar Objects

Each standard object should include these shared fields:

- `id`
- `source`
- `accountId`
- `platform`
- `capturedAt`
- `rawSourceId`
- `normalizedAt`
- `confidence`
- `notes`

Supported object types:

- `CreatorAccount`
- `Product`
- `Video`
- `SalesRecord`
- `SampleRecord`
- `CommentSignal`
- `AudienceSnapshot`
- `RewardRecord`
- `Action`
- `Lesson`
- `ImportBatch`

## Snapshot Records

Each Polaris sync creates a snapshot with:

- `snapshotId`
- `createdAt`
- `accountId`
- `source`
- `videoMetrics`
- `salesMetrics`
- `sampleMetrics`
- `audienceMetrics`
- `rewardMetrics`
- `notes`

Future comparison windows should support previous snapshot, 24 hours, 7 days, and 30 days.

## Live API Readiness

Live TikTok syncing will require:

- TikTok developer app
- OAuth/Login Kit
- Approved scopes
- Secure backend server
- Token storage
- TikTok Shop Partner API access
- Refresh token handling
- Privacy and data permission flow

Northstar currently uses manual capture and CSV import. Future live linking must use API approval and secure backend infrastructure before private creator data can be refreshed automatically.
