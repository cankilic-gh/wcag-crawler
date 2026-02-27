# I Built a Free WCAG Scanner That Finds 50x Fewer Duplicate Issues -- Here's How

**According to WebAIM's 2024 annual analysis, 96.3% of the top 1 million websites have detectable WCAG failures.** That is not a typo. Nearly every website you visit today has accessibility problems that affect real people.

I have been building accessible web applications for years, and I know that statistic is not going to surprise most developers. What might surprise you is why so few teams actually fix those issues -- even when they have the tools to find them.

The answer is noise.

I got tired of scrolling through 200+ identical accessibility issues, knowing that 180 of them were the exact same missing alt text in a shared header component. So I built something better.

---

## The Problem With Traditional Accessibility Scanners

Here is a scenario every frontend developer and QA engineer recognizes. You run an accessibility audit on a 50-page website. The report comes back with 347 issues. You open it, ready to improve your site, and you see:

- Page 1: "Images must have alternate text" (header logo)
- Page 2: "Images must have alternate text" (header logo)
- Page 3: "Images must have alternate text" (header logo)
- ...
- Page 50: "Images must have alternate text" (header logo)

That is 50 entries for a single image in a shared header component. The same pattern repeats for the navigation, the footer, and every other element that appears on every page. Your 347-issue report actually contains maybe 15 unique problems -- but you have to wade through the noise to find them.

**This is why developers ignore accessibility reports.** Not because they do not care, but because the signal-to-noise ratio is unbearable.

The problem gets worse at scale. Enterprise sites with hundreds or thousands of pages generate reports with tens of thousands of issues. Government agencies that are legally required to meet Section 508 compliance standards drown in false volume. Web agencies trying to deliver accessibility audits to clients spend hours manually deduplicating results.

Traditional automated accessibility testing tools are excellent at finding issues. They are terrible at telling you which issues actually matter and how many unique problems you need to fix.

---

## The Solution: Smart Component Deduplication

I built [WCAG Crawler](https://wcag.thegridbase.com) -- a free, open-source website accessibility checker that automatically groups shared component issues so you see each unique problem exactly once.

Here is what the difference looks like in practice:

```
Traditional Scanner          WCAG Crawler
------------------          ------------

Page 1: Missing alt text    Shared Header Component:
Page 2: Missing alt text      Missing alt text
Page 3: Missing alt text      Affects 50 pages
...
Page 50: Missing alt text   = 1 issue to fix!

= 50 issues to review!
```

Instead of reporting the same header issue 50 times, WCAG Crawler detects that the header is a shared component, groups all its issues together, and tells you how many pages are affected. Your 347-issue report becomes a clean list of 15 actionable items.

This is not just cosmetic. It fundamentally changes how teams approach accessibility compliance. When a developer opens a report and sees 15 clear issues with fix suggestions, they fix them. When they see 347 issues that feel overwhelming and repetitive, they close the tab.

---

## How the Deduplication Engine Works

The deduplication system uses a three-layer approach to eliminate duplicate issues without losing any information.

### Layer 1: Redirect Detection

Many websites have the same page accessible via multiple URLs. Think `/faq` redirecting to `/faq.action`, or `/about` and `/about/` resolving to the same content. During the crawling phase, WCAG Crawler follows every redirect and checks whether the final destination URL has already been visited. If it has, the duplicate URL is skipped entirely.

This is surprisingly common on enterprise sites running Java frameworks (Struts, Spring MVC, JSF) where URLs like `/page`, `/page.do`, `/page.action`, and `/page.jsf` all serve the same content.

### Layer 2: DOM Structure Fingerprinting

This is the core innovation. After scanning each page, WCAG Crawler creates structural fingerprints for every major DOM region -- header, navigation, footer, sidebar, and main content area.

The fingerprinting algorithm looks at the DOM structure of each region while ignoring dynamic content like text, URLs, and image sources. Two headers with different menu text but identical structure produce the same fingerprint. This means the scanner can confidently say: "These 50 pages all share the same header component, so any accessibility issues in that header only need to be reported once."

The engine also detects repeated elements by CSS selector. If the same `#search-button` appears on every page with the same accessibility issue, that gets grouped too.

### Layer 3: Content-Duplicate Page Detection

Some pages have completely identical content but no redirect relationship -- they are just different URLs serving the same page. WCAG Crawler catches these by comparing main content fingerprints across all pages. When there is no `<main>` element on the page, it falls back to a full body fingerprint with dynamic attributes stripped out.

There is even a final fallback layer: if two pages have the same title and an identical set of accessibility issues (same rules and selectors), they are treated as duplicates even if their DOM fingerprints do not match perfectly. This catches edge cases like forms with different `action` attributes but otherwise identical markup.

---

## What WCAG Crawler Tests

WCAG Crawler performs a full **WCAG 2.1 Level AA** audit on every page it scans. Under the hood, it uses [axe-core](https://github.com/dequelabs/axe-core) -- the same accessibility testing engine trusted by Microsoft, Google, and the U.S. Department of Homeland Security.

The scan process works in four phases:

**1. Crawling** -- You enter a URL, and WCAG Crawler automatically discovers every linked page within your domain using Playwright, a real browser automation engine. It respects configurable limits for maximum pages, crawl depth, and URL patterns to exclude.

**2. Scanning** -- Each discovered page is loaded in a real Chromium browser and tested against WCAG 2.1 AA criteria. This is not a static HTML check -- it evaluates the fully rendered page, including JavaScript-generated content, ARIA attributes, color contrast, keyboard navigation patterns, and more.

**3. Smart Deduplication** -- The three-layer deduplication engine analyzes all results, identifies shared components, groups duplicate issues, and marks content-duplicate pages.

**4. Actionable Reporting** -- The final report gives you:
- Issues grouped by severity: Critical, Serious, Moderate, and Minor
- Shared component summaries showing how many pages each issue affects
- Before and after code examples showing exactly how to fix each issue
- WCAG success criteria references for every violation
- Direct links to Deque University for detailed remediation guidance

You get real-time progress updates via WebSocket as the scan runs, so you can watch the results come in page by page.

---

## Who Should Use This

### Government Agencies

**Section 508** in the United States requires federal agencies and their contractors to make electronic and information technology accessible. The **European Accessibility Act (EAA)**, which takes full effect in June 2025, mandates accessibility for digital products and services across the EU. If your organization falls under either mandate, you need a way to audit your web properties systematically. WCAG Crawler lets you scan entire sites and get a clear picture of your compliance posture without drowning in duplicate findings.

### Web Agencies and Consultants

If you offer accessibility audits as a service, WCAG Crawler gives you a professional-grade starting point. The deduplicated reports are client-ready -- they communicate real issues without overwhelming non-technical stakeholders with hundreds of repeated line items. Run a scan, export the report, and use it as the foundation for your manual review.

### Enterprise Companies

**ADA-related web accessibility lawsuits continue to rise**, with the average settlement around $13,000 and some cases reaching six figures. Beyond litigation risk, accessibility issues directly impact your customer base -- an estimated 16% of the global population lives with some form of disability. WCAG Crawler helps enterprise teams proactively identify and prioritize accessibility issues across large web properties.

### Frontend Developers

If you care about building inclusive products (and you should), WCAG Crawler integrates into your development workflow. Run it against your staging environment before every release. The before-and-after code examples make it easy to understand and fix each issue, even if you are not an accessibility expert.

### QA Teams

Accessibility is a quality attribute. WCAG Crawler provides an API you can integrate into your CI/CD pipeline to catch regressions before they reach production. The programmatic API supports starting scans, polling for results, and exporting reports -- everything you need for automated quality gates.

---

## The Tech Stack

For those who want to know what is under the hood:

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand for state management
- **Backend:** Node.js, Express, Playwright for browser automation, axe-core for accessibility testing
- **Database:** SQLite via better-sqlite3 (fast, zero-configuration, serverless)
- **Real-time:** Socket.IO for live scan progress updates
- **Architecture:** pnpm monorepo with separate client and server packages

The entire project is **open source under the MIT license**. You can self-host it on your own infrastructure, deploy the backend to Railway or Render, and put the frontend on Vercel. There is also a Docker setup for one-command deployment.

Or just use the **free hosted version** at [wcag.thegridbase.com](https://wcag.thegridbase.com) -- no sign-up required.

---

## Configuration and Customization

WCAG Crawler is configurable out of the box:

| Option | Default | What It Does |
|--------|---------|--------------|
| Max Pages | 100 | Maximum pages to crawl per scan |
| Max Depth | 5 | How many links deep to follow from the start URL |
| Concurrency | 3 | Number of pages scanned simultaneously |
| Delay | 500ms | Pause between scan batches to avoid overloading servers |
| Exclude Patterns | None | URL patterns to skip (e.g., `/logout`, `*.pdf`) |
| Viewport | 1280x720 | Browser viewport size for responsive testing |

For enterprise sites, you can increase the page limit and concurrency. For servers that are sensitive to load, increase the delay. The exclude patterns let you skip authentication-gated pages, binary downloads, or any URL patterns that are not relevant to your audit.

---

## How It Compares

There are many accessibility testing tools available -- WAVE, Lighthouse, pa11y, Tenon, and others. Most of them are excellent single-page scanners. WCAG Crawler is not trying to replace them. It solves a different problem.

**Single-page tools** are great for checking individual pages during development. WCAG Crawler is for **site-wide audits** -- when you need to understand the accessibility posture of an entire web property, not just one page.

The key differentiator is deduplication. When you scan 100 pages with any other tool and aggregate the results, you get 100x the noise. When you scan 100 pages with WCAG Crawler, you get a clean, deduplicated report that tells you exactly what to fix and how many pages each fix will improve.

---

## Getting Started

### Use the Hosted Version

Go to [wcag.thegridbase.com](https://wcag.thegridbase.com), paste a URL, and click Scan. That is it. No account needed, no installation, no configuration.

### Self-Host

```bash
git clone https://github.com/cankilic-gh/wcag-crawler.git
cd wcag-crawler
pnpm install
pnpm db:migrate
pnpm dev
```

The app runs on `localhost:5173` (frontend) and `localhost:3001` (backend). You need Node.js 20 or later and pnpm.

### Docker

```bash
cd docker
docker-compose up -d
```

### Use the API

```bash
# Start a scan
curl -X POST https://wcag.thegridbase.com/api/scans \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "maxPages": 50}'

# Get the report
curl https://wcag.thegridbase.com/api/reports/{scanId}
```

---

## Why Accessibility Matters More Than Ever

Web accessibility is not optional. It is a legal requirement in a growing number of jurisdictions:

- **United States:** ADA Title III and Section 508 of the Rehabilitation Act
- **European Union:** European Accessibility Act (EAA), effective June 2025
- **Canada:** Accessible Canada Act
- **United Kingdom:** Equality Act 2010 and Public Sector Bodies Accessibility Regulations
- **Australia:** Disability Discrimination Act

Beyond legal compliance, accessibility is simply good engineering. The curb cut effect -- the principle that accommodations designed for people with disabilities often benefit everyone -- applies directly to the web. Captions help people in noisy environments. Keyboard navigation helps power users. Semantic HTML helps search engines. High contrast helps people using screens in bright sunlight.

An estimated 1.3 billion people worldwide live with some form of disability. When your website is inaccessible, you are excluding roughly 16% of the global population from using your product.

---

## What Comes Next

WCAG Crawler is actively developed and open to contributions. Here is what is on the roadmap:

- **GitHub Action** for automated accessibility checks in CI/CD pipelines
- **Historical trend tracking** to monitor accessibility improvements over time
- **WCAG 2.2 support** as axe-core adds new rules
- **PDF and CSV export** for compliance documentation
- **Multi-site dashboards** for agencies managing multiple properties

If you want to contribute, the project is on [GitHub](https://github.com/cankilic-gh/wcag-crawler). Issues and pull requests are welcome.

---

## Try It Now

The best time to start testing for accessibility was yesterday. The second best time is now.

- **Try it free:** [wcag.thegridbase.com](https://wcag.thegridbase.com)
- **Star on GitHub:** [github.com/cankilic-gh/wcag-crawler](https://github.com/cankilic-gh/wcag-crawler)
- **Report issues:** [GitHub Issues](https://github.com/cankilic-gh/wcag-crawler/issues)

If this tool helps you find and fix accessibility issues, consider sharing it with your team. Every site we make accessible is a step toward a more inclusive web.

---

*Tags: Accessibility, Web Development, WCAG, Open Source, JavaScript*
