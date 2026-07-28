import http from 'node:http';
import net from 'node:net';
import { chromium } from 'playwright';
import { afterEach, describe, expect, it } from 'vitest';
import { parseConnectAuthority, PublicNetworkProxy } from '../src/auth/public-network-proxy.js';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()));
});

describe('PublicNetworkProxy', () => {
  it('strictly parses CONNECT authorities and preserves explicit ports', () => {
    expect(parseConnectAuthority('example.com')).toEqual({ hostname: 'example.com', port: 443 });
    expect(parseConnectAuthority('example.com:80')).toEqual({ hostname: 'example.com', port: 80 });
    expect(parseConnectAuthority('example.com:443')).toEqual({ hostname: 'example.com', port: 443 });
    expect(parseConnectAuthority('[2001:4860:4860::8888]:8443')).toEqual({
      hostname: '[2001:4860:4860::8888]', port: 8443,
    });
    for (const malformed of [
      'user@example.com:443', 'example.com/path', 'example.com?x=1',
      'example.com:', '[2001:4860:4860::8888]:', 'example.com:0', 'example.com:65536',
      'example.com:443 ', ' example.com:443', 'example.com\t:443', 'example.com:\n443',
    ]) {
      expect(parseConnectAuthority(malformed)).toBeNull();
    }
  });

  it('blocks an HTTP request even when the private target is reachable locally', async () => {
    const target = http.createServer((_req, res) => res.end('internal-secret'));
    await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
    closers.push(() => new Promise(resolve => target.close(() => resolve())));
    const targetPort = (target.address() as net.AddressInfo).port;

    const proxy = new PublicNetworkProxy(async () => ['127.0.0.1']);
    const proxyUrl = await proxy.url();
    closers.push(() => proxy.close());
    const proxyPort = Number(new URL(proxyUrl).port);

    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1', port: proxyPort,
        path: `http://private.example:${targetPort}/secret`,
      }, res => { res.resume(); resolve(res.statusCode ?? 0); });
      req.on('error', reject);
      req.end();
    });

    expect(status).toBe(403);
  });

  it('blocks private CONNECT tunnels before opening a socket', async () => {
    const proxy = new PublicNetworkProxy(async () => ['127.0.0.1']);
    const proxyUrl = await proxy.url();
    closers.push(() => proxy.close());
    const proxyPort = Number(new URL(proxyUrl).port);

    const firstLine = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(proxyPort, '127.0.0.1', () => {
        socket.write('CONNECT private.example:443 HTTP/1.1\r\nHost: private.example:443\r\n\r\n');
      });
      socket.once('data', data => { resolve(data.toString().split('\r\n')[0]); socket.destroy(); });
      socket.on('error', reject);
    });

    expect(firstLine).toContain('403');
  });

  it('pins a real Chromium context to the proxy and blocks a private HTTP target', async () => {
    const target = http.createServer((_req, res) => res.end('internal-secret'));
    await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
    closers.push(() => new Promise(resolve => target.close(() => resolve())));
    const targetPort = (target.address() as net.AddressInfo).port;

    const proxy = new PublicNetworkProxy(async () => ['127.0.0.1']);
    const proxyUrl = await proxy.url();
    closers.push(() => proxy.close());
    const browser = await chromium.launch({ headless: true });
    closers.push(() => browser.close());
    const context = await browser.newContext({ proxy: { server: proxyUrl }, serviceWorkers: 'block' });
    const page = await context.newPage();

    const response = await page.goto(`http://private.example:${targetPort}/secret`);

    expect(response?.status()).toBe(403);
    expect(await page.textContent('body')).not.toContain('internal-secret');
  });
});
