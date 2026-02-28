<div align="center">

# WCAG Crawler

### The open-source accessibility scanner that cuts through the noise.

Scan entire websites for WCAG 2.1 AA issues. Smart deduplication groups shared component issues so you fix **1 problem, not 50 duplicates**.

[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG-2.1%20AA-4CAF50?style=for-the-badge)](https://www.w3.org/WAI/WCAG21/quickref/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/cankilic-gh/wcag-crawler?style=for-the-badge&logo=github)](https://github.com/cankilic-gh/wcag-crawler)
[![Powered by axe-core](https://img.shields.io/badge/Powered%20by-axe--core-663399?style=for-the-badge)](https://github.com/dequelabs/axe-core)

[Try It Free](https://wcag.thegridbase.com) · [Report Bug](https://github.com/cankilic-gh/wcag-crawler/issues) · [GitHub Action](#-github-action)

<br />

<img src="https://raw.githubusercontent.com/cankilic-gh/wcag-crawler/main/.github/screenshot.png" alt="WCAG Crawler - Accessibility Scanner Dashboard" width="800" />

</div>

---

## Why WCAG Crawler?

**96.3% of the top 1 million websites fail WCAG compliance** ([WebAIM 2024](https://webaim.org/projects/million/)). Traditional scanners make this worse by flooding you with duplicate issues.

A site with 50 pages and a broken header? That's **50 identical "missing alt text" reports**. WCAG Crawler groups them into **1 actionable issue**.

```
Traditional Scanner              WCAG Crawler
──────────────────              ────────────

Page 1: Missing alt text         Shared Component: Header
Page 2: Missing alt text         ├── Missing alt text
Page 3: Missing alt text         └── Affects 50 pages
...
Page 50: Missing alt text        = 1 issue to fix

= 50 issues to review
```

**Result:** Less noise. Faster fixes. Happier developers.

---

## Features

| Feature | Description |
|---------|-------------|
| **Full Site Crawling** | Automatically discovers and scans all pages within your domain |
| **WCAG 2.1 AA** | Tests against WCAG 2.0 A, 2.0 AA, 2.1 A, and 2.1 AA criteria |
| **Smart Deduplication** | Groups shared component issues (header, nav, footer) — 50x less noise |
| **Duplicate Page Detection** | Detects content-identical pages served at different URLs (`.action`, `.do`, `.jsf`) |
| **Real-Time Progress** | Live updates via WebSocket as your site is scanned |
| **Fix Suggestions** | Before/after code examples for every issue |
| **Severity Filtering** | Filter by Critical, Serious, Moderate, or Minor |
| **CI/CD Ready** | GitHub Action for automated accessibility testing in your pipeline |
| **Self-Hostable** | Docker support — run it on your own infrastructure |
| **Privacy-First** | No data leaves your instance. Scan history in localStorage |

---

## Quick Start

### Use the Hosted Version (Fastest)

Go to **[wcag.thegridbase.com](https://wcag.thegridbase.com)**, enter a URL, and scan. No account needed.

### Self-Host

```bash
# Clone and install
git clone https://github.com/cankilic-gh/wcag-crawler.git
cd wcag-crawler
pnpm install

# Run migrations and start
pnpm db:migrate
pnpm dev
```

Open http://localhost:5173 (frontend) and http://localhost:3001 (API).

### Docker

```bash
cd docker
docker-compose up -d
```

---

## How It Works

### 1. Crawl
Enter a URL. WCAG Crawler uses [Playwright](https://playwright.dev) to discover all linked pages within your domain — respecting depth limits and URL patterns.

### 2. Scan
Each page is tested with [axe-core](https://github.com/dequelabs/axe-core), the industry-standard accessibility engine used by Google, Microsoft, and the US government.

### 3. Deduplicate
This is the magic. WCAG Crawler:
- **Fingerprints DOM regions** (header, nav, footer, main, body) using SHA-256 hashes of normalized HTML structure
- **Groups shared issues** — if 50 pages share the same broken header, you see it once
- **Detects duplicate pages** — `/registration` and `/displayRegistration.action` serving identical content? Merged automatically
- **Catches repeated selectors** — `#search-button` failing on every page? One grouped issue

### 4. Report
Get actionable reports with severity filtering, before/after code fixes, WCAG criteria references, and direct links to [Deque University](https://dequeuniversity.com/).

---

## GitHub Action

Add WCAG scanning to your CI/CD pipeline:

```yaml
name: Accessibility Audit
on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: cankilic-gh/wcag-crawler@main
        with:
          url: 'https://your-site.com'
          threshold: 70           # Fail if score < 70
          fail-on-critical: true  # Fail on critical issues
```

### Action Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `url` | *required* | URL to scan |
| `max-pages` | `50` | Maximum pages to crawl |
| `max-depth` | `3` | Crawl depth limit |
| `threshold` | `0` | Minimum score to pass (0-100) |
| `fail-on-critical` | `false` | Fail if critical issues found |

---

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `maxPages` | 100 | Maximum pages to crawl |
| `maxDepth` | 5 | How many links deep to follow |
| `concurrency` | 3 | Simultaneous page scans |
| `delay` | 500ms | Delay between batches |
| `excludePatterns` | `[]` | URL patterns to skip (e.g., `/logout`, `*.pdf`) |
| `viewport` | 1280x720 | Browser viewport size |

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scans` | Start a new scan |
| `GET` | `/api/scans` | List all scans |
| `GET` | `/api/scans/:id` | Get scan details |
| `DELETE` | `/api/scans/:id` | Delete a scan |
| `POST` | `/api/scans/:id/cancel` | Cancel a running scan |
| `GET` | `/api/reports/:scanId` | Get full report |
| `GET` | `/api/reports/:scanId/export` | Export as HTML |

---

## Tech Stack

```
Frontend          Backend           Infrastructure
─────────         ───────           ──────────────
React 18          Express           Docker
TypeScript 5      Playwright        Railway / Render
Vite              axe-core          Vercel (client)
Tailwind CSS      SQLite            Socket.IO
Zustand           Node.js 20+
```

---

## Who Is This For?

**Government agencies** — Meet Section 508 and European Accessibility Act requirements with automated scanning.

**Web agencies** — Offer accessibility audits to clients. Generate professional reports in minutes.

**Enterprise** — Avoid ADA lawsuits (average settlement: $13K+). Scan hundreds of pages at once.

**Developers** — Integrate into CI/CD. Catch accessibility regressions before they ship.

---

## Deployment

<details>
<summary><strong>Frontend — Vercel</strong></summary>

```bash
cd packages/client
vercel --prod
```

Set environment variables:
```
VITE_API_URL=https://your-backend.up.railway.app
VITE_SOCKET_URL=https://your-backend.up.railway.app
```
</details>

<details>
<summary><strong>Backend — Railway</strong></summary>

1. Go to [railway.app](https://railway.app) and connect your GitHub repo
2. Railway auto-detects the Dockerfile
3. Add env vars: `CLIENT_URL`, `NODE_ENV=production`
4. Generate domain on port `3001`
</details>

<details>
<summary><strong>Backend — Render</strong></summary>

1. Go to [render.com](https://render.com) and connect your repo
2. Click "New" > "Blueprint" (auto-detects `render.yaml`)
3. Or manually: Web Service > Docker > Dockerfile path: `docker/Dockerfile`
</details>

<details>
<summary><strong>Environment Variables</strong></summary>

| Variable | Description | Example |
|----------|-------------|---------|
| `CLIENT_URL` | Frontend URL (CORS) | `https://wcag.thegridbase.com` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3001` |
</details>

---

## Need Continuous Monitoring?

> Need continuous monitoring, team dashboards, and automated alerts? Check out **[AccessPulse](https://accesspulse.thegridbase.com)** — our managed platform built on this engine.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

If you find WCAG Crawler useful, consider giving it a star — it helps others discover the project.

---

## License

MIT © [TheGridBase](https://thegridbase.com)

---

<div align="center">

**[Try WCAG Crawler Free](https://wcag.thegridbase.com)** · **[AccessPulse — Managed Monitoring](https://accesspulse.thegridbase.com)**

Built for web accessibility.

</div>
