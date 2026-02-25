export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Remove fragment
    url.hash = '';

    // Sort query parameters
    const params = new URLSearchParams(url.search);
    const sortedParams = new URLSearchParams([...params.entries()].sort());
    url.search = sortedParams.toString();

    // Remove trailing slash (except for root)
    let pathname = url.pathname;
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;

    // Lowercase hostname
    url.hostname = url.hostname.toLowerCase();

    return url.toString();
  } catch {
    return urlString;
  }
}

export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const parsed1 = new URL(url1);
    const parsed2 = new URL(url2);
    return parsed1.origin === parsed2.origin;
  } catch {
    return false;
  }
}

export function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isLocalhostUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost') ||
      // Also support common local network patterns
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) !== null
    );
  } catch {
    return false;
  }
}

export function isValidScanUrl(urlString: string): boolean {
  return isValidHttpUrl(urlString);
}

export function shouldSkipUrl(url: string, excludePatterns: string[]): boolean {
  // Skip binary files
  const binaryExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.eot'];
  const lowerUrl = url.toLowerCase();
  if (binaryExtensions.some(ext => lowerUrl.endsWith(ext))) {
    return true;
  }

  // Check exclude patterns
  for (const pattern of excludePatterns) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    if (regex.test(url)) {
      return true;
    }
  }

  return false;
}

export function resolveUrl(baseUrl: string, relativeUrl: string): string | null {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Extract a URL pattern by replacing numeric IDs with placeholders.
 * Used to detect duplicate page templates (e.g., news.action?id=3560 and news.action?id=3400).
 * Returns null if the URL has no variable parts (static pages are not pattern-limited).
 */
export function getUrlPattern(urlString: string): string | null {
  try {
    const url = new URL(urlString);

    // Replace numeric path segments with :id
    let hasVariable = false;
    const pathPattern = url.pathname
      .split('/')
      .map(segment => {
        if (/^\d+$/.test(segment)) {
          hasVariable = true;
          return ':id';
        }
        return segment;
      })
      .join('/');

    // Check if query params contain numeric values
    const params = new URLSearchParams(url.search);
    if (params.size > 0) {
      for (const [, value] of params) {
        if (/^\d+$/.test(value)) {
          hasVariable = true;
          break;
        }
      }
    }

    // Only return a pattern for URLs with variable parts
    if (!hasVariable) return null;

    const paramNames = [...params.keys()].sort().join('&');
    return paramNames ? `${pathPattern}?${paramNames}` : pathPattern;
  } catch {
    return null;
  }
}
