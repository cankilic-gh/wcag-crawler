# A11y Crawler - Project Instructions

## Project Overview

WCAG accessibility crawler and scanner. Crawls websites, runs axe-core analysis, deduplicates shared component issues, and generates accessibility reports with scores.

## Tech Stack

- **Server:** Node.js 20+, Express, Socket.IO, Playwright, @axe-core/playwright, better-sqlite3
- **Client:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts, Lucide
- **Monorepo:** pnpm workspaces (packages/server + packages/client)
- **Deploy:** Docker (Railway for server), Vercel (client)
- **DB:** SQLite (better-sqlite3, synchronous)

## Architecture - 4-Phase Scan Pipeline

```
Phase 1: CRAWLING (crawler.service.ts)
  - Playwright discovers URLs within same origin
  - Limits: maxPages, maxDepth, URL pattern dedup
  - Redirect duplicate detection (checks final URL after navigation)

Phase 2: SCANNING (scanner.service.ts)
  - Runs axe-core on each page (WCAG 2.1 AA tags only)
  - Generates region fingerprints (header, nav, footer, main, body, aside)
  - 60s timeout per page for axe-core, 10s for fingerprinting

Phase 3: ANALYZING (deduplication.service.ts)
  - Phase 2a: Groups by region fingerprints (shared header/nav/footer)
  - Phase 2b: Groups by repeated selectors across pages
  - Phase 3: Marks issues as shared_component
  - Phase 4: Identifies content-duplicate pages (main OR body fingerprint fallback)

Phase 4: REPORTING (report.service.ts)
  - Calculates weighted score (critical*25, serious*10, moderate*3, minor*1)
  - Builds shared component reports + page-specific reports
  - Emits scan:complete via WebSocket
```

## Database Schema (SQLite)

4 tables: `scans`, `pages`, `issues`, `shared_components`
- pages.regions_fingerprint: JSON with SHA-256 hashes per DOM region
- issues.is_shared_component + shared_component_group: dedup flags
- shared_components.region: 'header' | 'nav' | 'footer' | 'duplicate-page' | 'repeated-element'

## Known Gotchas & Lessons Learned

### URL Deduplication (3-layer system - DO NOT REGRESS)
1. **Crawler redirect check:** After page.goto(), compare final URL with original. Skip if final URL already visited.
2. **Scanner body fingerprint:** Always generate `body` region fingerprint as fallback when `<main>` element is absent.
3. **Dedup Phase 4:** Uses `main` fingerprint first, falls back to `body` fingerprint for content-duplicate page detection.

**Edge cases to verify when touching dedup:**
- (a) Redirect duplicates: /faq -> /faq.action
- (b) Framework suffix variants: /page vs /page.action, /page.do, /page.jsf
- (c) Query param variants: /news?id=1 vs /news?id=2 (pattern limiter, MAX_URLS_PER_PATTERN=3)
- (d) Content-identical with different URLs (no redirect)

### axe-core Timing
- axe-core analyze() has NO built-in timeout - always wrap with Promise.race(60s)
- extractRegionFingerprints also needs timeout (10s)
- Wait 1s after domcontentloaded before running axe

### Playwright Memory
- Close crawler browser BEFORE starting scanner browser (prevents OOM)
- Set per-page navigation timeout (30s)

### Socket.IO
- pingTimeout set to 120s to prevent disconnects during heavy SQLite operations
- Client reconnects automatically and rejoins scan room

## Commands

```bash
pnpm dev          # Dev mode (server + client concurrent)
pnpm build        # Build both packages
pnpm start        # Production server
pnpm db:migrate   # Run migrations
```

## Code Conventions

- Named exports (no default exports)
- Service classes with singleton exports: `export const fooService = new FooService()`
- Models use static methods: `PageModel.findByScanId(id)`
- All IDs: nanoid with prefix (scan_, pg_, iss_, sc_)
- Logs via custom logger (not console.log)

## Don't

- Don't use `waitUntil: 'networkidle'` - too slow for large sites, use 'domcontentloaded' + waitForTimeout(1000)
- Don't read entire DB into memory - use targeted queries with scan_id
- Don't skip dedup Phase 4 - duplicate pages are a common issue on enterprise sites (.action, .do, .jsf)
- Don't remove body fingerprint from scanner - it's the fallback for sites without <main> element
