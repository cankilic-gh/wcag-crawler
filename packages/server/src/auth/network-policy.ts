import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import type { Route } from 'playwright';

export type HostResolver = (hostname: string) => Promise<string[]>;
export type PublicUrlChecker = (url: string) => Promise<boolean>;

const BLOCKED_HOST_SUFFIXES = [
  '.internal',
  '.local',
  '.localhost',
  '.home.arpa',
];

const defaultResolver: HostResolver = async (hostname) => {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  return answers.map(answer => answer.address);
};

function normalizedHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

export async function isPubliclyRoutableUrl(
  urlString: string,
  resolver: HostResolver = defaultResolver,
): Promise<boolean> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const hostname = normalizedHostname(url.hostname);
    if (!hostname || hostname === 'localhost') return false;
    if (BLOCKED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))) return false;

    if (ipaddr.isValid(hostname)) return isPublicAddress(hostname);

    const addresses = await resolver(hostname);
    return addresses.length > 0 && addresses.every(isPublicAddress);
  } catch {
    return false;
  }
}

interface BrowserRoute {
  request(): { url(): string };
  continue(): Promise<unknown>;
  abort(errorCode?: string): Promise<unknown>;
}

export function createBrowserNetworkGuard(
  checkUrl: PublicUrlChecker = isPubliclyRoutableUrl,
): (route: BrowserRoute | Route) => Promise<void> {
  return async route => {
    const url = route.request().url();
    let protocol: string;
    try {
      protocol = new URL(url).protocol;
    } catch {
      await route.abort('blockedbyclient');
      return;
    }

    if (!['http:', 'https:'].includes(protocol)) {
      await route.continue();
      return;
    }

    if (await checkUrl(url)) {
      await route.continue();
      return;
    }
    await route.abort('blockedbyclient');
  };
}
