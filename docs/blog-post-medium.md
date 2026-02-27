# I Built a Free Tool That Scans Your Entire Website for Accessibility Issues -- And Tells You Exactly How to Fix Them

Ok so here's the thing. You know how 96.3% of the top million websites fail WCAG standards? (That's from WebAIM's 2024 report, not me being dramatic.) I kept running into the same problem -- I'd finish building a site, run Lighthouse on a couple pages, get a few green scores, and call it accessible. Spoiler: it wasn't.

The real issue is that most tools only check **one page at a time**. But accessibility problems live across your entire site. That missing alt text on your header logo? It's on every single page. That low-contrast button in the footer? Same thing. You don't know this until you check all the pages, and nobody's doing that manually on a 50-page site.

So I built [WCAG Crawler](https://wcag.thegridbase.com) -- a free, open-source tool that crawls your entire website, tests every page against **WCAG 2.1 Level AA** standards, and gives you a report with actual fix suggestions. Not just "this is broken" but "here's the code, here's what's wrong, here's how to fix it."

You can [try it right now](https://wcag.thegridbase.com) -- paste a URL, hit scan, done. No signup, no credit card, nothing.

---

## Why I Built This

I was working on a project for a client who needed Section 508 compliance. I ran the usual tools -- Lighthouse, WAVE, axe DevTools. They're all great, don't get me wrong. But they all do the same thing: check one page, show you a list of issues, and that's it.

My client had 80+ pages. I was supposed to... run Lighthouse 80 times? Copy-paste results into a spreadsheet? Manually figure out which issues are duplicates because the same header component shows up on every page?

No thanks.

What I actually needed was:
1. Point it at a URL
2. Let it find all the pages automatically
3. Get one clean report for the whole site
4. See exactly what to fix and how

That tool didn't exist the way I wanted it to. So I built it. And then I [open-sourced it](https://github.com/cankilic-gh/wcag-crawler).

---

## What It Actually Does

You go to [wcag.thegridbase.com](https://wcag.thegridbase.com), type in your URL, and click Scan. That's literally it. Here's what happens behind the scenes:

### 1. It Crawls Your Site

WCAG Crawler uses Playwright (a real Chromium browser, not some HTML parser) to visit your start URL and discover every linked page on your domain. It follows links, respects your page limits, and builds a map of your site.

You can configure how deep it goes:

| Setting | Default | What It Means |
|---------|---------|---------------|
| Max Pages | 100 | How many pages to check |
| Max Depth | 5 | How many clicks deep from your start URL |
| Concurrency | 3 | Pages scanned at the same time |
| Exclude Patterns | None | URLs to skip (like `/logout` or `*.pdf`) |
| Viewport | 1280x720 | Browser size for the test |

### 2. It Tests Every Page Against WCAG 2.1 AA

Each page gets loaded in a real browser and tested with [axe-core](https://github.com/dequelabs/axe-core) -- the same engine Microsoft, Google, and the U.S. Department of Homeland Security use. We're talking the full WCAG 2.1 Level AA ruleset:

- Color contrast ratios
- Missing alt text on images
- ARIA attributes and landmark regions
- Keyboard navigation and focus management
- Form labels and error handling
- Heading hierarchy
- And dozens more rules

This isn't a static HTML check. It evaluates the fully rendered page -- JavaScript content, dynamic elements, the works. If a screen reader would struggle with it, axe-core catches it.

You can watch all of this happen in real-time, by the way. The scanner streams progress updates live, so you see results coming in page by page.

### 3. Smart Deduplication (The Secret Sauce)

Ok so here's where it gets interesting. When you scan 50 pages, a traditional tool gives you 50x the issues because the same header, nav, and footer appear on every page. You end up with 300+ issues when really there are like 20 unique problems.

WCAG Crawler handles this automatically. It fingerprints your shared components (header, navigation, footer, sidebar) and groups duplicate issues together. So instead of seeing "missing alt text" 50 times, you see it once with a note saying "this affects 50 pages."

Your 300-issue nightmare becomes a clean 20-item to-do list. Same issues found, way less noise.

### 4. Actionable Reports

This is the part I'm most proud of. The report doesn't just say "you have problems." It gives you:

- **Severity levels** -- Critical, Serious, Moderate, Minor (so you know what to fix first)
- **Before/after code examples** -- literally shows you the broken code and the fixed version
- **WCAG success criteria references** -- which specific standard you're violating
- **Shared component grouping** -- fix it once in the header, fix it on 50 pages
- **An overall accessibility score** -- so you can track improvement over time

Here's a quick example. Instead of just saying "Images must have alternate text," the report shows you:

```html
<!-- What you have -->
<img src="logo.png">

<!-- What you should have -->
<img src="logo.png" alt="Company Logo">
```

That's actionable. A junior dev can pick that up and fix it in 30 seconds.

---

## Who Is This For?

**Frontend devs** -- Run it against staging before every release. You'll catch stuff Lighthouse misses because you're checking the whole site, not just the homepage. [Try it on your project](https://wcag.thegridbase.com).

**Agencies and consultants** -- If you do accessibility audits for clients, this gives you a solid automated baseline. The reports are clean enough to share directly. Run the scan, then layer your manual review on top.

**Government and enterprise** -- Section 508 (US), the European Accessibility Act (EU, effective June 2025), ADA Title III... the legal requirements keep growing. If you need to demonstrate compliance across a large site, [WCAG Crawler](https://wcag.thegridbase.com) gives you a complete picture without drowning in duplicates.

**QA teams** -- There's an API and a [GitHub Action](https://github.com/cankilic-gh/wcag-crawler) you can drop into your CI/CD pipeline. Set a score threshold, fail the build if accessibility regresses. Done.

---

## How It Compares to Other Tools

Let me be real -- WAVE, Lighthouse, pa11y, axe DevTools are all good tools. I use some of them myself. But they solve a different problem.

Those tools check **one page**. Great for development. But when you need a site-wide audit? You're on your own.

WCAG Crawler checks **your entire site** in one go. It automatically discovers pages, deduplicates shared component issues, and gives you one unified report. That's the difference.

| | Single-Page Tools | WCAG Crawler |
|---|---|---|
| Pages checked | 1 at a time | Whole site automatically |
| Duplicate handling | None | Smart component dedup |
| Fix suggestions | Sometimes | Before/after code examples |
| CI/CD integration | Varies | GitHub Action ready |
| Price | Varies | Free and open source |

---

## Running It Yourself

### Fastest Way -- Use the Hosted Version

Go to **[wcag.thegridbase.com](https://wcag.thegridbase.com)** and scan. No signup. No install. Free.

### Self-Host

```bash
git clone https://github.com/cankilic-gh/wcag-crawler.git
cd wcag-crawler
pnpm install
pnpm db:migrate
pnpm dev
```

Frontend runs on `localhost:5173`, backend on `localhost:3001`. You need Node.js 20+ and pnpm.

### Docker

```bash
cd docker
docker-compose up -d
```

### API

```bash
# Start a scan
curl -X POST https://wcag.thegridbase.com/api/scans \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "maxPages": 50}'

# Get the report
curl https://wcag.thegridbase.com/api/reports/{scanId}
```

### GitHub Action

```yaml
- uses: cankilic-gh/wcag-crawler@main
  with:
    url: 'https://your-site.com'
    threshold: 70
    fail-on-critical: true
```

Fail your build when accessibility drops. Your future self will thank you.

---

## The Tech Stack (For the Curious)

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, Playwright, axe-core
- **Database:** SQLite (zero config, serverless)
- **Real-time:** Socket.IO for live progress
- **Monorepo:** pnpm workspaces

Everything is MIT licensed. Fork it, self-host it, contribute to it -- whatever works for you.

---

## Why Accessibility Matters (The Quick Version)

1.3 billion people worldwide live with some form of disability. That's 16% of the global population. When your site isn't accessible, you're shutting the door on 1 in 6 potential users.

And it's not just the right thing to do -- it's increasingly the law:

- **US:** ADA Title III + Section 508
- **EU:** European Accessibility Act (June 2025)
- **Canada:** Accessible Canada Act
- **UK:** Equality Act 2010
- **Australia:** Disability Discrimination Act

ADA web accessibility lawsuits are trending up every year. Average settlement is around $13K, but some hit six figures. Way cheaper to just fix the issues upfront.

Plus, accessible code is better code. Semantic HTML helps SEO. Keyboard nav helps power users. Good contrast helps everyone on a sunny day. It's a win across the board.

---

## What's Next

The project is actively maintained and I've got plans:

- Historical trend tracking -- see your score improve over time
- WCAG 2.2 support as axe-core adds new rules
- PDF/CSV export for compliance docs
- Multi-site dashboards for agencies

Want to contribute? [The repo is here](https://github.com/cankilic-gh/wcag-crawler). Issues and PRs are welcome.

---

## Try It

Seriously, go scan your site right now. It takes 2 minutes and you might be surprised what you find.

**[wcag.thegridbase.com](https://wcag.thegridbase.com)** -- free, no signup, open source.

If it helps you out, drop a star on [GitHub](https://github.com/cankilic-gh/wcag-crawler). It helps other devs find the tool.

See you in the issues.

---

*Tags: WCAG, Accessibility, Web Development, Section 508, Open Source, axe-core, a11y*
