import { describe, expect, it } from 'vitest';
import type { Cookie } from 'playwright';
import { CrawlerService } from '../src/services/crawler.service.js';

describe('CrawlerService credential lifetime', () => {
  it('clears captured authentication cookies when the crawler closes', async () => {
    const crawler = new CrawlerService();
    const fixtureCookie: Cookie = {
      name: 'session',
      value: 'fixture-cookie-not-a-secret',
      domain: 'example.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    };
    Object.assign(crawler, { authCookies: [fixtureCookie] });

    await crawler.close();

    expect(crawler.getAuthCookies()).toEqual([]);
  });
});