# A11y Crawler

WCAG 2.1 AA Site-Wide Accessibility Scanner with Smart Component Deduplication.

## Features

- **Full Site Crawling** - Automatically discovers all pages on your website
- **WCAG 2.1 AA Compliance** - Tests against WCAG 2.1 Level AA success criteria
- **Smart Deduplication** - Identifies shared components (header, nav, footer) and groups their issues together
- **Real-Time Progress** - Live updates via WebSocket as your site is scanned
- **Beautiful Dashboard** - Dark mode UI with detailed reports
- **Export Reports** - Download self-contained HTML reports

## Tech Stack

- **Backend**: Node.js, Express, Playwright, axe-core
- **Frontend**: React 18, Vite, Tailwind CSS, Zustand
- **Database**: SQLite
- **Real-time**: Socket.IO

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/a11y-crawler.git
cd a11y-crawler

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Production

```bash
# Build
pnpm build

# Start
pnpm start
```

### Docker

```bash
cd docker
docker-compose up -d
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/scans | Start a new scan |
| GET | /api/scans | List all scans |
| GET | /api/scans/:id | Get scan details |
| DELETE | /api/scans/:id | Delete a scan |
| POST | /api/scans/:id/cancel | Cancel a running scan |
| GET | /api/reports/:scanId | Get full report |
| GET | /api/reports/:scanId/export | Export as HTML |

## Configuration

When starting a scan, you can configure:

| Option | Default | Description |
|--------|---------|-------------|
| maxPages | 100 | Maximum pages to crawl |
| maxDepth | 5 | Maximum link depth |
| concurrency | 3 | Simultaneous page scans |
| delay | 500ms | Delay between requests |
| excludePatterns | [] | URL patterns to skip |
| viewport | 1280x720 | Browser viewport size |

## Smart Deduplication

The killer feature of A11y Crawler is its smart component detection:

1. **Region Detection** - Identifies header, nav, footer, aside, and main regions
2. **Fingerprinting** - Creates structural hashes of each region (ignoring text content)
3. **Grouping** - Groups pages that share the same component fingerprints
4. **Deduplication** - Shows shared component issues once, with "affects N pages" badge

This dramatically reduces noise in reports for sites with consistent templates.

## License

MIT
