# a11y-crawler (WCAG Crawler) - Current State

**Last Updated:** 2026-07-28
**Status:** Active Development
**Priority:** High

## Active Decisions
- Monorepo with pnpm workspaces: packages/server (Node.js, Express, Playwright, axe-core) + packages/client (React, Vite, Zustand)
- 4-phase scan pipeline: Crawling -> Scanning -> Analyzing (Dedup) -> Reporting
- 3-layer deduplication: crawler redirect check, scanner body fingerprint, Phase 4/4.5 content-duplicate detection
- SQLite via better-sqlite3 (synchronous, no ORM)
- Deploy: Docker on Render (server), Vercel (client)
- This is the single active product-development focus; Haptic is parked
- Access model: anonymous quick, verified Google user, and exact allowlisted Google admin

## Current Focus
- Local auth/ownership implementation is complete; Google OAuth client creation, production env configuration, and coordinated server/client deployment still require explicit approval
- Commercialization trust baseline: repository license and third-party notices; independent auth/security closure review passed with no blocker/high/medium findings

## Blockers
- React Router 7.18.1 closes the prior SPA open-redirect/XSS advisories. Audit still reports GHSA-qwww-vcr4-c8h2 (high), which applies to RSC action mode; this BrowserRouter SPA has no RSC/action APIs. `react-router` 8.3.0 is published, but the matching `react-router-dom` release remains 7.18.1, so forcing only the transitive package would be an unsupported mismatch. Keep this documented exception until a compatible `react-router-dom` fix is published.
- README links to an MIT `LICENSE` file that is not present in the repository

## Recent Changes
- Added server-verified Google bearer authentication with exact admin allowlist, immutable Google-sub ownership, anonymous capability hashes, admin-only legacy scans, owner-filtered history, report/export/fix/cancel/delete authorization, authorized Socket.IO joins, and role-scoped scan rate limiting. Policies are anonymous 10/2/1, verified user 50/3/2, admin 100/5/3; only admin may use target-site credentials.
- Added public-target SSRF protection at route, browser-request, and exact-IP-pinning local proxy layers; private/reserved IPv4/IPv6, redirects, DNS rebinding, service workers, and non-proxied WebRTC are denied for anonymous/user scans. Added a FIFO scan-job scheduler and scan-ID-scoped cancellation to isolate the existing mutable crawler/scanner services.
- Added Google GIS client UI, session-scoped identity-token storage, per-scan anonymous capability storage, authenticated API/socket requests, owner-aware history, role-aware limits, and header-bearing blob exports. No production OAuth client or deployment was created.
- Migrated React Router 6 to 7.18.1 to close the prior SPA open-redirect/XSS advisories.
- Added an ESLint 9 flat-config quality gate for root JavaScript, client/server TypeScript, React Hooks, and server tests; CI now runs lint before build
- Production dependency-security remediation retains axios ^1.18.1 and parent-scoped pnpm overrides; React Router is now 7.18.1
- Replaced full-compliance marketing language with accurate automated axe-core checks and explicit manual-evaluation limitations
- Added exported-report and client SSR regression tests for automated-testing claims
- Corrected report terminology: deduplicated findings are no longer presented as the same metric as distinct axe rule types
- Added a client SSR regression test for report metric terminology
- Added client Vitest 3.2.6 and upgraded server Vitest to 4.1.10, avoiding CVE-2026-47429 while preserving Vite 5 compatibility
- Smart deduplication system completed (3-layer + Phase 4.5 issue-signature fallback)
- Body fingerprint fallback for sites without `<main>` element
- Per-page axe-core timeout with Promise.race (60s)
- Region fingerprint extraction timeout (10s)

## Tech Debt
- Integration tests needed for full dedup pipeline
- Multiple edge cases require regression tests: redirect dupes, framework suffixes (.action/.do/.jsf), query param variants, content-identical pages
- Scanner memory management could be improved (sequential browser close)
- Socket.IO pingTimeout at 120s is a workaround, not a fix
- Production client bundle is approximately 718 kB minified and triggers Vite's 500 kB chunk warning
- `crawlerService`/`scannerService` remain process-wide singletons; concurrent scan jobs can overwrite shared browser/config state. Per-job service instances or a serialized durable queue are required before multi-tenant production use
