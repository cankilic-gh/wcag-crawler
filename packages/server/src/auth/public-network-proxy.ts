import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { Duplex } from 'node:stream';
import { lookup } from 'node:dns/promises';
import { isPublicAddress, type HostResolver } from './network-policy.js';

const DENIED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home', '.lan'];

function hasAsciiControlOrWhitespace(value: string): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 32 || code === 127;
  });
}

export function parseConnectAuthority(value: string): { hostname: string; port: number } | null {
  try {
    if (value !== value.trim() || hasAsciiControlOrWhitespace(value) || value.endsWith(':')) return null;
    const target = new URL(`https://${value}`);
    if (target.username || target.password || target.pathname !== '/' || target.search || target.hash) return null;
    const port = Number(target.port || 443);
    if (!target.hostname || !Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { hostname: target.hostname, port };
  } catch {
    return null;
  }
}

async function defaultResolver(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) return [hostname];
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map(result => result.address);
}

function normalizedHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

export class PublicNetworkProxy {
  private server: http.Server | null = null;
  private addressUrl: string | null = null;

  constructor(private readonly resolver: HostResolver = defaultResolver) {}

  async url(): Promise<string> {
    if (this.addressUrl) return this.addressUrl;
    this.server = http.createServer((req, res) => void this.forwardHttp(req, res));
    this.server.on('connect', (req, socket, head) => void this.forwardConnect(req, socket, head));
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address() as net.AddressInfo;
    this.addressUrl = `http://127.0.0.1:${address.port}`;
    return this.addressUrl;
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.addressUrl = null;
    if (!server) return;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }

  private async pinnedAddress(hostname: string): Promise<string | null> {
    const normalized = normalizedHostname(hostname);
    if (!normalized || normalized === 'localhost'
      || DENIED_HOST_SUFFIXES.some(suffix => normalized.endsWith(suffix))) return null;
    try {
      const addresses = await this.resolver(normalized);
      if (addresses.length === 0 || addresses.some(address => !isPublicAddress(address))) return null;
      return addresses[0];
    } catch {
      return null;
    }
  }

  private async forwardHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      res.writeHead(403).end();
      return;
    }
    const address = await this.pinnedAddress(target.hostname);
    if (!address) {
      res.writeHead(403).end();
      return;
    }

    const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host };
    delete headers['proxy-connection'];
    const transport = target.protocol === 'https:' ? https : http;
    const upstream = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
      lookup: (_hostname, _options, callback) => {
        callback(null, address, net.isIP(address) as 4 | 6);
      },
    }, upstreamResponse => {
      res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  }

  private async forwardConnect(
    req: http.IncomingMessage,
    clientSocket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const target = parseConnectAuthority(req.url ?? '');
    if (!target) {
      clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const address = await this.pinnedAddress(target.hostname);
    if (!address) {
      clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }

    const upstream = net.connect(target.port, address, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on('error', () => clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
    clientSocket.on('error', () => upstream.destroy());
  }
}

export const publicNetworkProxy = new PublicNetworkProxy();
