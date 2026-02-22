import { createHash } from 'crypto';

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function generateFingerprint(html: string): string {
  // Normalize the HTML structure for fingerprinting
  const normalized = normalizeHtmlStructure(html);
  return sha256(normalized);
}

function normalizeHtmlStructure(html: string): string {
  // Remove all text content - keep only structure
  let normalized = html.replace(/>([^<]+)</g, '><');

  // Remove volatile attributes
  const volatileAttrs = ['id', 'style', 'nonce', 'csrf', 'value', 'data-[^=]*'];
  for (const attr of volatileAttrs) {
    const regex = new RegExp(`\\s${attr}="[^"]*"`, 'gi');
    normalized = normalized.replace(regex, '');
  }

  // Sort class names within class attributes
  normalized = normalized.replace(/class="([^"]*)"/g, (match, classes) => {
    const sorted = classes.split(/\s+/).filter(Boolean).sort().join(' ');
    return `class="${sorted}"`;
  });

  // Remove whitespace between tags
  normalized = normalized.replace(/>\s+</g, '><');

  // Lowercase all tag names
  normalized = normalized.replace(/<\/?[A-Z][A-Z0-9]*/g, tag => tag.toLowerCase());

  return normalized.trim();
}

export type DomRegion = 'header' | 'nav' | 'footer' | 'aside' | 'main' | 'unknown';

export function detectRegionFromSelector(selector: string): DomRegion {
  const lowerSelector = selector.toLowerCase();

  if (lowerSelector.includes('header') || lowerSelector.includes('[role="banner"]')) {
    return 'header';
  }
  if (lowerSelector.includes('nav') || lowerSelector.includes('[role="navigation"]')) {
    return 'nav';
  }
  if (lowerSelector.includes('footer') || lowerSelector.includes('[role="contentinfo"]')) {
    return 'footer';
  }
  if (lowerSelector.includes('aside') || lowerSelector.includes('[role="complementary"]')) {
    return 'aside';
  }
  if (lowerSelector.includes('main') || lowerSelector.includes('[role="main"]')) {
    return 'main';
  }

  return 'unknown';
}
