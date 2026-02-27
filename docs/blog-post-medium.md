# I Built a Free Tool That Scans Your Entire Website for Accessibility Issues

You know how 96.3% of the top million websites fail WCAG standards? (WebAIM's 2024 report, not me being dramatic.) I kept running into the same problem -- I'd finish building a site, run Lighthouse on a couple pages, get a few green scores, and call it accessible. Spoiler: it wasn't.

Most tools only check **one page at a time**. But accessibility problems live across your entire site. That missing alt text on your header logo? It's on every single page. That low-contrast button in the footer? Same thing. Nobody's checking all 50 pages manually.

So I built **WCAG Crawler** -- a free, open-source tool that crawls your entire website, tests every page against WCAG 2.1 Level AA, and gives you a report with actual fix suggestions. Not just "this is broken" but "here's the code, here's how to fix it."

Oh, and the whole thing was built with AI. More on that later.

<!-- SCREENSHOT: Homepage with scan form -->

---

## Why I Built This

I had a client who needed Section 508 compliance. 80+ pages. I ran the usual tools -- Lighthouse, WAVE, axe DevTools. They all do the same thing: check one page, show a list, done.

Was I supposed to run Lighthouse 80 times? Copy-paste into a spreadsheet?

No thanks.

What I needed was simple:
1. Point it at a URL
2. Let it find all the pages
3. Get one clean report for the whole site
4. See exactly what to fix and how

That tool didn't exist. So I built it and open-sourced it.

---

## How It Works

Type a URL, click Scan. Here's what happens:

### 1. Crawls Your Site

Uses Playwright (a real Chromium browser) to discover every linked page on your domain. You set the limits -- max pages, depth, patterns to exclude.

### 2. Tests Every Page Against WCAG 2.1 AA

Each page gets loaded in a real browser and tested with axe-core -- the same engine Microsoft and Google use. Color contrast, alt text, ARIA, keyboard nav, form labels, heading hierarchy... the full ruleset.

This isn't a static HTML check. It tests the fully rendered page, JavaScript and all.

<!-- SCREENSHOT: Scan progress page with real-time updates -->

### 3. Smart Deduplication

When you scan 50 pages, traditional tools give you 50x the issues because the same header appears on every page. WCAG Crawler fingerprints shared components and groups duplicates. Your 300-issue report becomes a 20-item to-do list.

### 4. Actionable Reports

The report gives you severity levels (Critical > Serious > Moderate > Minor), before/after code examples, WCAG references, and an overall score.

<!-- SCREENSHOT: Report page showing issue details with code fix -->

Instead of just saying "Images must have alternate text," you see:

```html
<!-- What you have -->
<img src="logo.png">

<!-- What you should have -->
<img src="logo.png" alt="Company Logo">
```

A junior dev can fix that in 30 seconds.

---

## Built With AI

Here's the thing most people won't tell you -- this entire project was built with AI-assisted development. Architecture decisions, the deduplication algorithm, the scanning pipeline, the UI... all developed in collaboration with Claude.

I'm not saying AI wrote everything and I hit publish. It was more like pair programming on steroids. I'd describe what I needed, we'd discuss the approach, iterate on the implementation, and debug together. The dedup engine went through several iterations before we landed on the three-layer fingerprinting system.

Building with AI didn't make the project less "real." It made it possible for a solo developer to ship something that would normally take a team. The code quality, the test coverage, the architecture -- it's all solid because I had an AI partner that never gets tired of refactoring.

If you're curious about building full products with AI, WCAG Crawler is a good case study of what's possible.

---

## Who Is This For?

**Frontend devs** -- Run it against staging before every release. You'll catch stuff Lighthouse misses because you're checking the whole site, not just the homepage.

**Agencies** -- Gives you a solid automated baseline for client accessibility audits. Reports are clean enough to share directly.

**Government and enterprise** -- Section 508, European Accessibility Act, ADA Title III... legal requirements keep growing. Get a complete compliance picture across your entire site.

**QA teams** -- Drop the GitHub Action into your CI/CD pipeline. Set a threshold, fail the build if accessibility regresses.

---

## Running It

**Hosted (fastest):** Go to [wcag.thegridbase.com](https://wcag.thegridbase.com) and scan. No signup, free.

**Self-host:**

```bash
git clone https://github.com/cankilic-gh/wcag-crawler.git
cd wcag-crawler
pnpm install && pnpm db:migrate && pnpm dev
```

**GitHub Action:**

```yaml
- uses: cankilic-gh/wcag-crawler@main
  with:
    url: 'https://your-site.com'
    threshold: 70
    fail-on-critical: true
```

**API:**

```bash
curl -X POST https://wcag.thegridbase.com/api/scans \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "maxPages": 50}'
```

---

## Why Accessibility Matters

1.3 billion people live with some form of disability -- 16% of the world. When your site isn't accessible, you're shutting the door on 1 in 6 users.

It's also the law in more places every year (US, EU, Canada, UK, Australia). ADA lawsuits are trending up, average settlement around $13K. Way cheaper to just fix things upfront.

And honestly, accessible code is just better code. Semantic HTML helps SEO. Keyboard nav helps power users. Good contrast helps everyone.

---

## Try It

Go scan your site. Takes 2 minutes. You might be surprised.

**[wcag.thegridbase.com](https://wcag.thegridbase.com)**

The project is on [GitHub](https://github.com/cankilic-gh/wcag-crawler) -- MIT licensed, contributions welcome.

---

*Tags: WCAG, Accessibility, AI Development, Web Development, Section 508, Open Source, axe-core*
