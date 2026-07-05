# Northstar

Version 0.2

Day One Edition

July 2026

**Creator Operating System**

Data becomes direction.

One place to guide every creator decision.

Northstar is the creator intelligence platform for Jennifer's creator business. It combines Morning Briefs, Pulse Signals, Action Plans, captures, imports, reviews, products, videos, hooks, samples, knowledge, and local persistence into one premium local app.

![Northstar Mark](assets/brand/northstar-mark.svg)

## Brand System

Core branded terms:

- The Pulse Engine™
- The Spark™
- The Confidence Engine™
- The Creator Compass™
- The Mark™
- The Morning Brief™
- The Knowledge Vault™

The Mark™ assets live at:

`assets/brand/northstar-mark.svg`
`assets/brand/northstar-mark-dark.svg`
`assets/brand/northstar-mark-light.svg`
`assets/brand/northstar-wordmark.svg`
`assets/brand/northstar-horizontal.svg`
`assets/brand/northstar-app-icon.svg`
`assets/brand/favicon.svg`

The full brand usage guide lives at:

`docs/brand/the-mark.md`

The Mark™ v1.0 is the official Northstar symbol. It combines The Creator Compass™ and The Spark™.

The Creator Compass™ is a minimal four-point compass. It is modern, symmetrical, premium, and intentionally not nautical, vintage, or ornate. Its four points represent:

- North: What should I create?
- East: What should I sell?
- South: What should I improve?
- West: What should I stop doing?

The Spark™ is the center element: two overlapping four-point stars with a warm gold center and subtle glow. It represents the moment data becomes direction. The Spark should feel rare and meaningful, not decorative.

Northstar principles:

- Data becomes direction.
- Every page should answer: What changed? Why does it matter? What should I do next?
- The 15-Second Rule™: If a creator closes Northstar after 15 seconds, they should already know what to do today.
- Signals matter more than statistics.
- Briefs should produce action, not just reporting.
- Every recommendation should be remembered, reviewed, and improved.

## Open On Mac

1. Open Finder.
2. Open the `Northstar Version 0.1 Day One Edition` folder.
3. Double-click `index.html`.

Northstar is local only. There is no login, no backend server, and no public website.

## Navigation

- Morning Brief
- Opportunity Center
- Products
- Videos
- Hooks
- Content Planner
- Knowledge Vault
- Brands
- Data Hub
- Settings

## Northstar v0.2: Navigation + Product Lifecycle

Northstar v0.2 simplifies the primary navigation around creator business decisions:

- Morning Brief
- Opportunity Center
- Products
- Videos
- Hooks
- Content Planner
- Knowledge Vault
- Brands
- Data Hub
- Settings

Renames:

- Workspaces is now Brands.
- Calendar is now Content Planner.

Data Hub consolidates the older import and connection tools.

Data Hub tabs:

- Connections
- Imports
- Review
- CSV
- OCR
- Manual Entry
- API Status

Products now manages both products and sample flow. Product top-level tabs:

- Live
- Request
- Film
- Posted

Request includes subtabs:

- Ideas
- Request Samples
- Requested
- Approved
- Shipped
- Delivered

Film includes subtabs:

- Waiting to Film
- Filmed

The Ideas tab is for future product opportunities Jennifer is considering but has not requested yet. Examples include fall garden products, fall wellness products, holiday gift products, football or tailgating products, and water quality products to research.

Northstar does not use a Retired product lifecycle tab. Opportunity Center now shows Double Down, Watch, and Wait. If a product should not receive more effort, Northstar simply omits it from Today's Direction.

Morning Brief v0.2 is ordered as a daily Creator Command Center:

- Monthly Progress
- Raised Right Brief and Truth Tuned Tribe Brief
- Today's Direction
- Pulse Report

Monthly Progress appears first and shows money, units, videos, progress bars, projection, days remaining, and one motivational momentum line.

Pulse Report replaces Weekly Intelligence Brief and explains what changed, why it matters, and what to do next.

The lower-left sidebar card now shows a rotating Northstar Insight from the Knowledge Vault when possible, with version information kept smaller.

## Brand Review

Brand Review is the official read-only inspection page for The Mark™ before future revisions.

It includes:

- The Official Mark™ as it should appear on a website homepage
- Full Horizontal, Stacked, Mark Only, Wordmark Only, App Icon, and Favicon variations
- White, dark, soft ivory, and navy background tests
- Logo size checks from 24px to 512px
- Official brand color swatches
- Official typography hierarchy

## TikTok Connection

TikTok Connection is a planning page for future TikTok and TikTok Shop account linking.

It does not connect to TikTok yet.

Northstar currently uses manual capture and CSV import. Live TikTok linking requires API approval and secure backend infrastructure.

The page tracks:

- Raised Right connection readiness
- Truth Tuned Tribe connection readiness
- Connection status: Manual / CSV / API Pending
- Last local data refresh
- Data sources needed for future linking
- Future API checklist for OAuth, scopes, TikTok Shop Partner access, backend server, secure token storage, and refresh schedule

## Sprint 10: Update Northstar™

Update Northstar prepares the Morning Brief for future one-click account syncing.

The **Update Northstar** button appears in the Morning Brief header.

Today it opens Update Center in:

- Current mode: Manual / CSV
- Future mode: Live TikTok Sync

Update Center includes:

- Connected accounts: Raised Right and Truth Tuned Tribe
- Account status: Manual / CSV / API Pending
- Last updated
- Next available data source
- Update sources: Manual Capture, CSV Import, Screenshot Import placeholder, TikTok API placeholder, TikTok Shop API placeholder
- Data needed: video analytics, sales, GMV, commission, samples, product invitations, comments, followers, Creator Rewards
- Future one-click sync message
- Sync History saved locally

The reusable sync function is:

`runNorthstarUpdate(source, account)`

For now, this function simulates a sync, records Sync History in localStorage, and refreshes the Morning Brief from local data. It does not attempt a real TikTok API connection.

## Project Polaris: Real Data Operating Sprint

Polaris is the single source-of-truth layer behind Northstar's real creator data.

Sample records now live in:

`db.samples`

Northstar also mirrors that same array to `db.sampleRecords` and `db.sampleRequests` so older screens continue to work while the app moves to one Polaris Database.

Each sample record can include:

- Account
- Product Name
- Brand
- Category
- Status
- Priority
- Date Requested
- Date Approved
- Date Shipped
- Date Delivered
- Expected Arrival
- Campaign Due Date
- Tracking Number
- Tracking URL
- Content Idea
- Hook Idea
- Notes
- Related Product / Video IDs
- Estimated GMV
- Estimated Commission
- Source
- Last Updated

Sample statuses:

- Idea
- Request Now
- Requested
- Approved
- Shipped
- Delivered
- Waiting to Film
- Filmed
- Posted
- Complete

The Sample Pipeline page is a Kanban workflow. Changing a sample status saves to localStorage and refreshes Northstar direction.

## Import Center

Import Center is the place to bring real data into Polaris.

Tabs:

- Videos
- Samples
- Products
- Sales
- Screenshots Coming Soon
- Live Sync Future

The Samples tab supports pasted CSV or JSON. It previews before import, detects duplicates by `Product Name + Account`, updates existing samples when a match is found, adds new samples when no match exists, and shows Added / Updated / Skipped / Errors.

Sample CSV header:

```csv
Account,Product Name,Brand,Category,Status,Priority,Date Requested,Date Approved,Date Shipped,Date Delivered,Expected Arrival,Campaign Due Date,Content Idea,Hook Idea,Notes
```

Before the sample migration runs, Northstar tries to preserve a local backup of the current saved browser database at `northstar.v01.prePolarisSampleBackup`.

Morning Brief now reads Upcoming Content Inventory from `db.samples` and shows the Polaris sample count. Action Plan also creates sample actions such as Request sample, Follow up requested sample, Film delivered sample, Create hook idea, Post filmed sample, and Move sample to complete.

## Data Seed: July 2, 2026

Northstar includes a Truth Tuned Tribe morning update seed for July 2, 2026.

The seed file is:

`data/july-2-2026-seed.js`

It adds or updates:

- 15 Truth Tuned Tribe videos
- July 1, 2026 sales for Complete Peptide Protocols Playbook, Ultimate Peptide Protocols Bible, and 7X Reversible Candle Breaks Witchcraft
- Content Intelligence fields for revenue, growth, trust, education, product demo, community, Creator Rewards, Audience Capital, and Trust Score placeholders
- Content Intelligence lessons in the Knowledge Vault

The app applies this seed on refresh and updates matching records instead of creating duplicates.

## Sprint 8: Executive Morning Brief™

Executive Morning Brief makes the homepage direction-first.

The current v0.2 Morning Brief is organized as a Creator Command Center:

- Monthly Progress
- Raised Right Brief and Truth Tuned Tribe Brief
- Today's Direction
- Pulse Report

The homepage follows The 15-Second Rule™: if a creator closes Northstar after 15 seconds, they should already know what to do today.

## Morning Brief v2: Account-Based Briefing

Morning Brief now separates direction for Jennifer's two creator accounts:

- Raised Right
- Truth Tuned Tribe

Morning Brief now starts with money and monthly progress, then shows brand-level direction for each account.

Each account brief includes:

- Account Spark
- Top Three Actions: Film, Request, Watch / Improve
- Sample Inventory
- Revenue Snapshot
- Content Snapshot

Sample inventory is now grouped inside the brand briefs and product lifecycle. Shared “Both” samples can appear under both accounts. These sections read from Polaris data: `db.videos`, `db.products`, `db.samples`, `db.salesRecords`, and local action records when available.

Developer diagnostics show per-account counts for videos, products, samples, sales records, and actions, plus any “Awaiting Polaris data” warnings.

Pulse Report and deeper intelligence now sit below the brand briefs and Today's Direction:

- Pulse Report
- Product Movement
- Category Movement
- Account Comparison
- Decision Log
- Knowledge Vault
- Import Review

## Sprint 9: Premium Experience™

Premium Experience is a UX polish sprint. It adds no new functionality.

Philosophy:

- Northstar should feel like a Creator Intelligence Platform, not a reporting dashboard.
- The interface should disappear so Jennifer can focus on today's direction.
- Brand comes first. Morning Brief is the feature, not the hero.
- Gold is rare. The Spark remains the brightest gold element.

Typography hierarchy:

- Large hero: NORTHSTAR
- Medium section: Data becomes direction.
- Small label: Morning Brief, Today's Spark, action labels
- Body: reasons, lessons, and direction
- Caption: dates, metadata, confidence details

Spacing system:

- Use an 8-point grid.
- Keep the first screen compact enough for a 13-inch MacBook.
- Use white space instead of heavy borders to create emphasis.
- Align cards and sections consistently.

Color usage:

- White and soft ivory are the primary canvas.
- Film uses navy.
- Request uses gold.
- Watch uses teal.
- Confidence colors are green, amber, and red, used sparingly.

Icon system:

- Navigation uses a consistent outline SVG icon family.
- Icons are quiet and functional.
- Letter circles were removed from navigation.

Interaction principles:

- Cards lift slightly on hover.
- Buttons gently brighten or lift.
- Navigation softly highlights.
- No bouncing, flashing, or loud animation.

## Sprint 7: The Intelligence Engine™

The Intelligence Engine connects products, Signals, actions, and lessons so Northstar begins answering: **What should I do next?**

Sprint 7 adds:

- Opportunity Score™ for every product, scored 0-100
- Product Lifecycle™ stages: Emerging, Growing, Peak, Slowing, Retired
- Double Down Engine™ recommendations
- Seasonal Engine™ with manual season editing on each product detail page
- Category Intelligence™ summaries
- Account Comparison™ cards for Raised Right and Truth Tuned Tribe
- Pulse Report on the Morning Brief page
- Decision Quality™ for completed actions
- A one-sentence Intelligence Banner at the top of Morning Brief

Opportunity Score uses local product data only:

- Sales velocity
- Commission potential
- Units sold
- Seasonal fit
- Audience fit
- Recent momentum
- Confidence score

Products now sort automatically by Opportunity Score. Product cards, product rows, recommendations, Hall of Fame, and product detail pages show Opportunity and Lifecycle Signals.

The Seasonal Engine supports these product seasons:

- Spring
- Summer
- Back to School
- Halloween
- Holiday
- Winter
- Evergreen
- Seasonal

To manually change a product season:

1. Open **Products**.
2. Click a product.
3. Use the **Manual season** dropdown in Product Intelligence.
4. Northstar saves the season locally in this browser.

Decision Quality appears in the Decision Log after an action is completed. Northstar uses the action confidence and your result notes to label the decision as Excellent Decision, Good Decision, Neutral, Poor Decision, or Pending.

## Sprint 6: Action Plan™ + The Mark™ Foundation

Action Plan answers: **What should I do next based on the latest data?**

Action Plan includes:

- Today's Top 5 Actions
- Action categories: Film, Request, Repost, Retire, Watch, Learn
- Complete, Snooze, Dismiss, and Add Note controls
- Action History saved locally
- Recommendation reasons for every action
- The Confidence Engine™ scoring model
- Export Today's Action Plan as plain text or JSON

Decision Log remembers every recommendation and whether it worked. Each Action Plan recommendation automatically creates or updates a Decision Log entry with date recommended, action, account, product/category, confidence, status, completed date, result notes, and outcome notes.

Knowledge Vault now preserves lessons learned with title, account, product, category, tags, lesson text, confidence, date added, related action, and related video. It is searchable, filterable, editable, and saved to localStorage.

Northstar language was updated around Morning Brief, Pulse Signals, Action Plan, Knowledge Vault, Captures, Sparks, Signals, and Briefs.

## Sprint 3: Fast Capture™

Fast Capture answers: **How can I add today's creator activity in under 60 seconds?**

Open **Fast Capture™** from the sidebar to add:

- A product
- A video
- A performance snapshot
- A lesson learned

Each capture saves to browser localStorage and updates Northstar's local database. Product captures appear in Products and Opportunity Center. Video captures appear in Videos. Performance snapshots update the related product or video totals and feed the Pulse Engine™. Lesson captures appear in the Knowledge Vault™.

After each save, Northstar shows:

`Captured. Northstar will use this in future recommendations.`

The page also tracks **Last Captured** and shows an export-backup reminder after every 10 captures.

## Fast Capture Backup Habit

Fast Capture saves locally inside the browser on this Mac. After a busy capture session:

1. Open **Settings**.
2. Click **Export Backup**.
3. Keep the downloaded JSON file somewhere safe.

To restore later, use **Import Backup** on the Settings page.

## Sprint 4: Bulk Import™

Bulk Import answers: **How can I bring in a week or month of creator data quickly?**

In v0.2, open **Data Hub → CSV** to import CSV files for:

- Product sales
- Video analytics
- Sample requests

The import wizard follows this flow:

1. **Upload** - choose a data type, default account, and CSV file.
2. **Map Fields** - match CSV columns to Northstar fields.
3. **Preview** - review rows detected, columns detected, missing fields, duplicates, invalid numbers, empty rows, and estimated new records.
4. **Confirm** - choose how to handle duplicates: skip, update existing, or create duplicate.
5. **Done** - Northstar saves the import locally and adds it to Import History.

Bulk Import also includes blank template downloads for product sales, video analytics, and sample requests.

Imported data is saved in browser localStorage and feeds Products, Videos, the product/sample lifecycle, Opportunity Center, and the Pulse Engine™.

## Sprint 11: Polaris™ Update Northstar Data Pipeline

Polaris is the foundation for one-click updates. The creator-facing promise is simple: click **Update Northstar**, let Northstar gather what is available, normalize the Signals, detect change, and refresh the Morning Brief.

Northstar is **API-ready, but not API-connected yet**. Today, Polaris uses local manual captures, CSV imports, saved products, saved videos, samples, lessons, and local performance snapshots. Future live linking requires official platform approval and secure infrastructure.

Polaris lives in:

`integrations/polaris/`

Files:

- `polaris.js` - main orchestration layer
- `adapters.js` - source readiness for TikTok Studio, TikTok Shop, Creator Rewards, CSV Import, Screenshot OCR, Manual Capture, future Instagram, future YouTube, and future Amazon
- `normalizer.js` - converts source data into Northstar standard objects
- `validators.js` - checks missing fields, invalid numbers, duplicates, and suspicious values
- `sync-history.js` - stores every update attempt locally
- `README.md` - technical API-readiness notes

The Update Center now shows:

- Connected accounts
- Current mode: Manual / CSV
- Future mode: Live TikTok Sync
- Polaris Data Sources
- Update progress: Connecting sources, Capturing data, Normalizing data, Detecting changes, Updating Morning Brief, Complete
- Sync History with captured, updated, skipped, warnings, errors, status, and detail view

### Import Center

Use **Data Hub → CSV** when you need to add historical videos before live TikTok sync exists or bring in batches without typing everything manually.

The v0.2 Data Hub includes tabs for:

- Connections
- Imports
- Review
- CSV
- OCR
- Manual Entry
- API Status

CSV and JSON imports accept these fields:

- Account
- Date posted
- Product/topic
- Category
- Hook
- Purpose
- Views
- Likes
- Comments
- Shares
- Saves/favorites
- Average watch time
- Completion %
- Followers gained
- Sales
- GMV
- Commission
- Creator rewards
- Notes

Northstar previews the batch before saving, detects duplicates by account + date posted + hook/product, updates existing videos when a duplicate is found, creates new videos when no match exists, and saves directly into the Polaris Database in localStorage. Screenshot OCR and Live TikTok Sync are placeholder tabs for future work. After import, Videos, Morning Brief, Action Plan, Products, and Intelligence all read from the same updated `db.videos` source of truth.

Each sync creates local snapshot records for future comparison:

- Previous snapshot
- 24 hours
- 7 days
- 30 days

Live TikTok syncing will require a TikTok developer app, OAuth/Login Kit, approved scopes, secure backend server, token storage, TikTok Shop Partner API access, refresh token handling, and privacy/data permission flow.

## Sprint 5: Import Review™

Import Review answers: **Did this import work correctly?**

After you confirm a CSV import, Northstar creates an Import Review automatically when applicable. Open **Data Hub → Review** to check:

- File name, import date, account, data type, imported rows, skipped rows, updated rows, and errors
- Reconciliation totals for GMV, commission, units sold, products, videos, and sales records
- Manual TikTok totals compared against Northstar totals
- Difference and difference percentage
- Status badge: Matched, Small Difference, or Needs Review
- Flagged issues such as missing product names, $0 GMV with units sold, commission higher than GMV, negative values, duplicate products, empty categories, unmapped columns, and suspicious values
- Fix Queue actions: Edit, Ignore, Merge duplicate, Assign category, and Mark reviewed

When an import looks clean, click **Mark Import Reviewed** and add review notes. Northstar stores the reviewed date, reviewer, and notes locally.

## Sprint 2: Pulse™

The Morning Brief now opens with **NORTHSTAR PULSE**.

Core question: **What changed since the last time I looked?**

Pulse includes:

- Snapshot engine using browser localStorage
- Comparison against previous snapshot, 7 days, or 30 days
- What Changed alerts
- Today's top recommendation with confidence score
- Second recommendation with confidence score
- Product Movement: Top Gainers, Top Decliners, New Sellers, Products Cooling, Dormant Products
- Category Movement with arrows
- Pulse History timeline
- Decision Log that stores recommendations locally
- Alert types: green opportunity, gold important, red action needed, blue observation
- Subtle pulse animation on the Northstar mark when meaningful change is detected

Northstar remains platform-agnostic. Future data sources can feed the same local intelligence engine.

## Sprint 1: Morning Brief

The Morning Brief is designed as a CEO briefing and answers: **What should I do today?**

Today includes:

- Good Morning header with date and Northstar mark
- Today's Focus
- Priority cards: Film, Request, Repost, Analyze
- Product Spotlight
- Opportunity Panel
- Knowledge Card
- Seasonal Reminder
- Sample Pipeline Summary
- Account Health
- Quick Actions

Charts are intentionally reduced. Action Plan direction and next moves are prioritized.

## Workspaces

- ❤️ Raised Right
- 💙 Truth Tuned Tribe

## Day One Features

- Northstar Intelligence
- Northstar Score
- Opportunity Center
- Product timelines
- Sample pipeline
- Local saving
- Backup export/import
- Knowledge Vault
- Briefs

## Version History

### Version 0.1 - Day One Edition - July 2026

The first Northstar-branded release. Repositioned from a dashboard into a creator operating system with premium brand identity, workspace launcher, operating-system navigation, and decision-first language.

### Legacy Foundation

Before the Northstar rename, the app evolved through internal build stages: initial June dashboard, database foundation, local persistence, and intelligence engine. Northstar Version 0.1 combines those foundations into one creator operating system.

## Real Data Sprint

Northstar now includes real daily data entry paths inside **Data Hub** so Jennifer can update Polaris without editing JSON.

Use **Data Hub → Quick Daily Update** for the fastest daily check-in:

- Account
- Date
- GMV today and GMV this month
- Commission today and commission this month
- Units sold
- Videos posted
- Best product
- Best video
- New samples approved, shipped, and delivered
- Notes

Saving this form updates Polaris localStorage, monthly progress, account briefs, Today’s Direction, and Pulse Report. Northstar also stores the update in `dailyUpdates` and updates the matching monthly report in `monthlyReports`.

Use **Data Hub → Bulk Paste Import** when you have more rows to add. Supported paste types:

- Videos
- Product sales
- Samples
- Monthly totals

Before saving, Northstar shows a validation preview with records added, records updated, possible duplicates, missing fields, and totals preview. Imports are saved to the Polaris database and then the Morning Brief refreshes from the updated data.

Use **Data Hub → Templates** to copy starter rows for:

- Video analytics
- Product sales
- Sample requests
- Monthly account totals

Backup safety: before each Quick Daily Update or Bulk Paste Import, Northstar creates a local backup snapshot in `backupSnapshots`. The latest snapshots are stored locally in the browser so you have a recovery point before new real data is added.

Developer diagnostics on Morning Brief now include quiet source labels showing the source and last updated time for key sections: Monthly Progress, Raised Right Brief, Truth Tuned Tribe Brief, Today’s Direction, and Pulse Report.

## Real Data + Signal Lifecycle Sprint

Northstar now applies a 14-day **Signal Collection** rule across Products, Videos, Opportunity Center, Morning Brief, and Today’s Direction.

Any product or video posted within the last 14 days is treated as:

- Lifecycle: New
- Signal Collection
- Days since posted
- Days remaining before evaluation
- Too early to judge

Northstar should not call new posts failed, dead, retired, weak, or underperforming during this window. After 14 days, Northstar may evaluate the signal into Double Down, Watch, Wait, or Cooling.

The July 3 real-data seed adds:

- Raised Right July 2-3 videos, including Fourth of July Flyover Schedule, New Air Force One Flyover, CERN / Time Returned Post, and Freeze Pop / Heat Product
- Truth Tuned Tribe July 3 Copper Plant Stakes video
- July 3 Raised Right sales records
- July 3 Truth Tuned Tribe sales records
- Waiting-to-film samples for RAD Recovery Rounds, Dashing Diva nails, and Smart AI Glasses
- Yesterday’s Learnings for the Morning Brief
