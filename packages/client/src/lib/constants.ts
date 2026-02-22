export const SEVERITY_COLORS = {
  critical: {
    bg: 'bg-critical/20',
    text: 'text-critical',
    border: 'border-critical/30',
    hex: '#ef4444',
  },
  serious: {
    bg: 'bg-serious/20',
    text: 'text-serious',
    border: 'border-serious/30',
    hex: '#f97316',
  },
  moderate: {
    bg: 'bg-moderate/20',
    text: 'text-moderate',
    border: 'border-moderate/30',
    hex: '#eab308',
  },
  minor: {
    bg: 'bg-minor/20',
    text: 'text-minor',
    border: 'border-minor/30',
    hex: '#3b82f6',
  },
} as const;

export const REGION_ICONS = {
  header: '🔝',
  nav: '🧭',
  footer: '🔻',
  aside: '📎',
  main: '📄',
  unknown: '❓',
} as const;

export const STATUS_LABELS = {
  pending: 'Pending',
  crawling: 'Crawling',
  scanning: 'Scanning',
  analyzing: 'Analyzing',
  complete: 'Complete',
  failed: 'Failed',
} as const;

export const VIEWPORT_PRESETS = [
  { label: 'Desktop', width: 1280, height: 720 },
  { label: 'Tablet', width: 768, height: 1024 },
  { label: 'Mobile', width: 375, height: 667 },
] as const;

export const DEFAULT_SCAN_CONFIG = {
  maxPages: 100,
  maxDepth: 5,
  concurrency: 3,
  delay: 500,
  excludePatterns: [],
  waitForSelector: null,
  respectRobotsTxt: true,
  viewport: { width: 1280, height: 720 },
  authentication: null,
};
