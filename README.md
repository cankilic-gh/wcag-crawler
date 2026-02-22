<div align="center">

# WCAG Crawler

**Site-Wide Accessibility Scanner with Smart Component Deduplication**

[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG-2.1%20AA-4CAF50?style=for-the-badge)](https://www.w3.org/WAI/WCAG21/quickref/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Live Demo](https://wcag.thegridbase.com) · [Report Bug](https://github.com/cankilic-gh/wcag-crawler/issues)

<img src="https://raw.githubusercontent.com/cankilic-gh/wcag-crawler/main/.github/screenshot.png" alt="WCAG Crawler Screenshot" width="800" />

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **Full Site Crawling** | Automatically discovers and scans all pages on your website |
| **WCAG 2.1 AA Testing** | Tests against WCAG 2.0 A, 2.0 AA, 2.1 A, and 2.1 AA criteria |
| **Smart Deduplication** | Groups shared component issues (header, nav, footer) to reduce noise |
| **Selector-Based Grouping** | Detects repeated elements across pages (e.g., search buttons) |
| **Real-Time Progress** | Live updates via WebSocket as your site is scanned |
| **Fix Suggestions** | Before/after code examples for common accessibility issues |
| **Severity Filtering** | Filter by Critical, Serious, Moderate, or Minor issues |
| **Privacy-First** | Scan history stored in your browser's localStorage |

## Tech Stack

```
Frontend          Backend           Database        Real-time
─────────         ───────           ────────        ─────────
React 18          Express           SQLite          Socket.IO
TypeScript        Playwright
Vite              axe-core
Tailwind CSS
Zustand
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/cankilic-gh/wcag-crawler.git
cd wcag-crawler

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

### Production Build

```bash
pnpm build
pnpm start
```

### Docker

```bash
cd docker
docker-compose up -d
```

## How It Works

### 1. Crawling
Enter a URL and WCAG Crawler discovers all linked pages within your domain.

### 2. Scanning
Each page is tested using [axe-core](https://github.com/dequelabs/axe-core), the industry-standard accessibility testing engine.

### 3. Smart Deduplication
This is what makes WCAG Crawler special:

```
Traditional Scanner          WCAG Crawler
──────────────────          ────────────

Page 1: Missing alt text    Shared Component: Header
Page 2: Missing alt text    ├── Missing alt text
Page 3: Missing alt text    └── Affects 50 pages
...
Page 50: Missing alt text   = 1 issue to fix!

= 50 issues to review
```

**How it works:**
- Detects structural regions (header, nav, footer, aside, main)
- Creates fingerprints based on DOM structure (ignoring text content)
- Groups issues from identical components across pages
- Also detects repeated selectors (e.g., `#search-button` on every page)

### 4. Reporting
Get actionable reports with:
- Severity-based filtering (Critical & Serious = WCAG violations)
- Before/after code examples
- Affected pages list
- WCAG criteria references
- Direct links to Deque University for detailed guidance

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `maxPages` | 100 | Maximum pages to crawl |
| `maxDepth` | 5 | How many links deep to follow |
| `concurrency` | 3 | Simultaneous page scans |
| `delay` | 500ms | Delay between batches (prevents server overload) |
| `excludePatterns` | `[]` | URL patterns to skip (e.g., `/logout`, `*.pdf`) |
| `viewport` | 1280×720 | Browser viewport size |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scans` | Start a new scan |
| `GET` | `/api/scans` | List all scans |
| `GET` | `/api/scans/:id` | Get scan details |
| `DELETE` | `/api/scans/:id` | Delete a scan |
| `POST` | `/api/scans/:id/cancel` | Cancel running scan |
| `GET` | `/api/reports/:scanId` | Get full report |
| `GET` | `/api/reports/:scanId/export` | Export as HTML |

## Deployment

### Frontend (Vercel)
```bash
cd packages/client
vercel --prod
```

### Backend (Railway/Render)
The backend requires Playwright (browser automation), so it needs a platform that supports browsers:
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Fly.io](https://fly.io)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [TheGridBase](https://thegridbase.com)

---

<div align="center">

Built with ❤️ for web accessibility

**[wcag.thegridbase.com](https://wcag.thegridbase.com)**

</div>
