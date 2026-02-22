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
