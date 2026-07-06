# Northstar Creator SDLC User Guide

Version: 0.2  
Date: July 5, 2026  
Audience: New users, Jennifer, developers, reviewers, and future collaborators

## 1. Executive Summary

Northstar Creator is a private beta Creator Business Operating System. It helps a creator turn TikTok Shop, product, sample, video, hook, and sales data into one clear daily direction.

Northstar is designed to answer one practical question:

What should Jennifer film today?

The app is not meant to be a generic analytics dashboard. It is meant to be a decision system. Instead of forcing the creator to dig through exports, screenshots, product lists, and notes, Northstar organizes creator-commerce signals into a Morning Brief, Product Workspaces, video history, sample tracking, hooks, scripts, and next-step recommendations.

## 2. Product Purpose

Northstar exists to help creators:

- Know which products deserve attention.
- Track samples from arrival through filming and posting.
- Preserve winning hooks, scripts, and video ideas.
- Connect videos to products, sales, GMV, commission, and lessons learned.
- Reduce manual decision fatigue.
- Build repeatable creator-commerce workflows from proven results.

Northstar's working brand promise is:

Data becomes direction.

Supporting statement:

One place to guide every creator decision.

## 3. Intended Users

Primary user:

- Jennifer, creator and creator-commerce operator managing multiple TikTok accounts.

Supported account structure:

- Raised Right
- Truth Tuned Tribe

Future users may include:

- TikTok Shop creators
- Affiliate creators
- Product reviewers
- Creator-led commerce teams
- Operators who manage sample flow, product testing, hooks, and sales performance

## 4. Problem Northstar Solves

Creators often have useful data scattered across too many places:

- TikTok Studio
- TikTok Shop
- CSV exports
- Screenshots
- Product sample approvals
- Notes
- Hook ideas
- Product links
- Video analytics
- Sales reports

Without a system, creators may:

- Forget which samples need to be filmed.
- Repeat weak hooks.
- Lose track of products that already sold.
- Chase views instead of sales.
- Miss sample deadlines.
- Guess what to film next.
- Separate content performance from product performance.

Northstar turns that scattered information into a daily operating workflow.

## 5. System Overview

Northstar currently has two connected parts:

1. Local Northstar app
   - Runs by opening `index.html` on Jennifer's Mac.
   - Uses HTML, CSS, JavaScript, local data files, and browser localStorage.
   - No login.
   - No backend server for the local app.
   - Stores lightweight user edits locally.

2. Public NorthStar Creator website
   - Hosted through GitHub Pages from the `docs` folder.
   - Used as the public product site for credibility, policy pages, and TikTok Developer review.
   - Includes Home, Privacy Policy, Terms of Service, and Contact pages.

Important current limitation:

Northstar is prepared for TikTok connection, but live TikTok OAuth and TikTok Shop API syncing require official API approval and secure backend infrastructure. The repo must not contain API keys, client secrets, tokens, passwords, or private account data.

## 6. Core Principles

Northstar is guided by these product principles:

- Direction over dashboards.
- Decisions over raw metrics.
- Sales-first, not views-first.
- Product history should follow the product through its full lifecycle.
- Morning Brief should stay clean and answer what to do today.
- Product Workspace is where deeper creative work happens.
- Every sample card should lead back to one product workspace.
- Data should have one source of truth whenever possible.
- Local data must be preserved defensively.
- Private tokens and secrets must never be committed.

## 7. Main User Workflow

### Step 1: Open Northstar

Open the local app by double-clicking:

`index.html`

The app opens in the browser from Jennifer's local Mac folder.

Start on the Morning Brief.

### Step 2: Read the Morning Brief

The Morning Brief is the first page and should answer:

- What matters today?
- What should be filmed?
- Which account needs attention?
- Which sample has a deadline?
- Which sales or video signal changed?

The Morning Brief should stay short and scannable.

### Step 3: Review Waiting to Film

Waiting to Film samples are grouped by account:

- Raised Right
- Truth Tuned Tribe

Each sample card should show:

- Product image
- Product name
- Account or brand
- Days left, if available
- Sample status, if available

Clicking a sample opens the full Product Workspace.

### Step 4: Open a Product Workspace

The Product Workspace is the command center for one product.

It should include:

- Product image
- Product name
- Account
- Category
- Seasonality
- Sample status
- Arrival or status dates
- Related videos
- Sales, GMV, commission, and units
- Notes
- Hook Generator
- Script Generator
- Caption Generator
- Hashtag Generator
- Shot List
- CTA Generator
- Complete Video Builder

This is where Jennifer should plan the next piece of content.

### Step 5: Create Content Direction

Inside Product Workspace, Jennifer can generate:

- Hooks
- Scripts
- Captions
- Hashtags
- Shot lists
- B-roll checklists
- CTA options
- Complete video plans

Generated ideas should be saved to the product so Northstar can learn what was planned, filmed, posted, and tested.

### Step 6: Update Data

Use Data Hub or import tools to add real creator activity:

- New videos
- Product sales
- Sample updates
- Monthly totals
- Notes
- Performance snapshots

Northstar should preserve existing data and merge new information carefully.

### Step 7: Review Products and Videos

Products and Videos pages provide deeper review.

Use Products to understand:

- Product history
- Images
- Account
- Category
- GMV
- Commission
- Units
- Opportunity
- Next direction

Use Videos to understand:

- Date
- Account
- Product
- Hook
- Views
- Engagement
- Watch time
- Sales
- GMV
- Commission

## 8. Product and Sample Lifecycle

Northstar uses one simplified product/sample lifecycle:

Waiting to Film -> Filmed -> Posted -> Sales Evaluation -> Hook Testing

Older statuses such as Requested, Approved, Shipped, and Delivered may exist in historical records, but the active creator workflow should focus on what matters now:

- Is the product waiting to be filmed?
- Has it been filmed?
- Has it been posted?
- Did it sell?
- What hook should be tested next?

Samples should not become separate disconnected objects. A sample should connect to the same product record and use the same imageUrl wherever it appears.

Product image rule:

- Save product images once on the product record as `imageUrl`.
- Reuse that image in Morning Brief, Products, Product Detail, Hook Generator, Script Generator, Video Builder, and related sample cards.
- Do not store base64 images in localStorage.

## 9. Data Model Overview

Northstar data is organized around this relationship:

Video -> Product(s) -> Sales/GMV/Commission -> Insights

Important data records:

- Products
  - Product ID
  - Product name
  - Account
  - Category
  - Image URL
  - Seasonality
  - GMV
  - Commission
  - Units
  - Related videos
  - Notes

- Videos
  - Video ID
  - Account
  - Product
  - Hook
  - Publish date
  - Views
  - Likes
  - Comments
  - Shares
  - Saves
  - Watch time
  - Sales
  - GMV
  - Commission
  - Cover image, when available

- Samples
  - Product name
  - Product ID, when available
  - Account
  - Status
  - Days left or due date
  - Image URL
  - Notes

- Hooks and creative ideas
  - Hook text
  - Product
  - Account
  - Status
  - Date created
  - Performance, if tested

- Sales records
  - Product ID
  - Video ID, if available
  - Date
  - Units sold
  - GMV
  - Commission

- Notes and lessons
  - Product notes
  - What worked
  - What to test next
  - Future video ideas

## 10. Local Storage and Backup Rules

Northstar should not save the entire large database into localStorage on every load.

localStorage should be used for lightweight user-created changes, such as:

- Notes
- Manual edits
- Sample status changes
- Saved hooks
- Added videos
- Decisions
- Generated creative plans

Large historical datasets should remain in bundled static files.

Before major imports or cleanup, Jennifer should export a backup when available.

If localStorage quota is reached, Northstar should:

- Keep rendering the app.
- Show a warning.
- Avoid blocking startup.
- Never delete Jennifer's data automatically.

## 11. Public Website Overview

The public NorthStar Creator website is separate from the local operating app.

The website should communicate:

- What NorthStar Creator is
- Who it is for
- How it helps creators
- Privacy Policy
- Terms of Service
- Contact information

The public website should not claim an official TikTok partnership unless that status is actually approved.

Safe language:

- Prepared for TikTok connection
- TikTok OAuth coming soon
- Private beta creator intelligence platform

Avoid:

- Fake testimonials
- Claims of live TikTok syncing before it exists
- Exposing private data
- Publishing API credentials

## 12. SDLC View

This section explains Northstar using a Software Development Life Cycle structure.

### Phase 1: Requirements

Business need:

Jennifer needs one system that tells her what to film, request, review, and improve next.

Functional requirements:

- Morning Brief
- Product Workspace
- Product image support
- Waiting to Film sample cards
- Product and video tables
- Data Hub
- Hook, script, caption, hashtag, and video plan generation
- Backup/export safety
- Public website with policies

Non-functional requirements:

- Local-first
- Fast loading
- No horizontal scrolling
- No broken layout
- No data loss
- No secrets committed
- Clear documentation
- Git safety checkpoints

### Phase 2: Design

Design goals:

- Premium, calm, modern interface
- Light dashboard style
- Easy scanning
- Product images everywhere they matter
- Morning Brief stays concise
- Product Workspace holds the deeper workflow

Information architecture:

- Morning Brief for daily direction
- Products for lifecycle and product management
- Videos for performance review
- Data Hub for imports and updates
- Product Workspace for creative planning
- Settings for backup and storage health

### Phase 3: Development

Development rules:

- Preserve all existing data.
- Avoid clearing localStorage.
- Use defensive merge logic.
- Use product ID first for matching.
- Use normalized product name only as fallback.
- Keep large bundled datasets out of localStorage.
- Keep TikTok secrets out of the repo.

### Phase 4: Testing

Testing should confirm:

- App loads without staying on a loading screen.
- Morning Brief renders.
- Products render without horizontal scrolling.
- Videos render without horizontal scrolling.
- Waiting to Film counts are consistent.
- Sample cards open Product Workspace.
- Product images appear where available.
- Product names and hooks do not overflow cards.
- Placeholder videos do not count in metrics.
- localStorage quota does not block startup.
- Public website loads on GitHub Pages.

### Phase 5: Deployment

Local app deployment:

- Open `index.html` directly on Mac.
- No server required for the local app.

Public website deployment:

- GitHub Pages serves the `docs` folder.
- Public pages include Home, Privacy Policy, Terms of Service, and Contact.

### Phase 6: Operations

Ongoing operation includes:

- Add daily creator data.
- Import videos and product sales.
- Review Waiting to Film samples.
- Generate hooks and scripts.
- Mark products as filmed and posted.
- Export backups regularly.
- Record meaningful site and app changes in `Documentation`.

### Phase 7: Maintenance

Maintenance priorities:

- Keep the app fast.
- Keep data safe.
- Keep documentation current.
- Keep the public website credible for review.
- Avoid duplicate records.
- Improve import tools.
- Prepare secure TikTok OAuth and API integration.

## 13. QA Checklist

Use this checklist after meaningful changes:

- Morning Brief opens quickly.
- Monthly Progress is visible.
- Spark Report shows only high-value signals.
- Waiting to Film samples show images.
- Raised Right and Truth Tuned Tribe are separated.
- Sample cards click into Product Workspace.
- Product Workspace has image, product details, generators, notes, and related videos.
- Products page has no horizontal scroll.
- Videos page has no horizontal scroll.
- Commission and GMV columns display fully.
- Product images persist across pages.
- No "Untitled video" placeholder rows appear in counts.
- No "Unassigned product" placeholder rows appear in counts.
- No Retire language appears in the product workflow.
- localStorage is not cleared.
- Backup/export remains available.
- Public website still has Privacy Policy, Terms, and Contact links.

## 14. Change Documentation Rules

Every meaningful change should be documented in the root `Documentation` file.

Each entry should include:

- Date
- Change title
- Files changed
- Developer notes
- User notes
- Verification
- Follow-up

Developer notes should explain what changed technically.

User notes should explain what Jennifer or a website visitor will notice.

Never document or commit:

- API keys
- Client secrets
- Access tokens
- Refresh tokens
- Passwords
- Private TikTok account data

## 15. Roadmap

Available now:

- Local Northstar app
- Morning Brief
- Product Workspace foundation
- Product and video records
- Sample tracking
- Product images
- Hook and script planning
- Public NorthStar Creator website
- Git safety checkpoints

Prepared or planned:

- Cleaner Data Hub imports
- TikTok initial import flow
- TikTok OAuth connection
- TikTok Shop data sync
- Daily incremental sync
- Secure backend token storage
- Video thumbnails from TikTok imports
- More complete product-to-video-to-sales intelligence

## 16. Glossary

Northstar Creator:

The creator intelligence platform and public-facing product brand.

Northstar local app:

The local Mac app Jennifer opens with `index.html`.

Morning Brief:

The daily briefing page that answers what Jennifer should film today.

Product Workspace:

The detailed workspace for one product, including creative tools, notes, videos, and performance.

Waiting to Film:

Products or samples that need content soon.

Spark Report:

Three concise high-value signals surfaced in the Morning Brief.

Data Hub:

The place for importing, pasting, or updating creator data.

GMV:

Gross merchandise value.

Commission:

Affiliate or creator-commerce earnings from product sales.

Hook:

The opening idea or first line of a video meant to capture attention.

CTA:

Call to action.

SDLC:

Software Development Life Cycle. A structured way to describe requirements, design, development, testing, deployment, operations, and maintenance.

