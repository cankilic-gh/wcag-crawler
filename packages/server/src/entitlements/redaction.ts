import type { ScanConfig } from '../models/scan.model.js';

/**
 * Credential redaction — defense in depth.
 *
 * Authentication credentials (username/password) must reach the in-memory
 * scan runner so it can log in, but they must NEVER be persisted to the
 * database or returned by any list/detail/report API. Redaction is applied
 * at persistence time (ScanModel.create), at read time (findById/findAll),
 * and once at startup for legacy rows (cleanupLegacyCredentials).
 *
 * Redaction keeps authType/loginUrl (useful, non-secret) and empties the
 * username/password. Emptying (rather than deleting) is idempotent and keeps
 * the ScanConfig shape stable for TypeScript and API consumers.
 */

const REDACTED = '';

const CREDENTIAL_QUERY_PARAMS = new Set([
  'accesstoken', 'refreshtoken', 'idtoken', 'oauthtoken',
  'auth', 'authorization', 'authorizationcode', 'apikey', 'clientsecret',
  'code', 'credential', 'jwt', 'key', 'pass', 'password', 'passwd',
  'secret', 'session', 'sessionid', 'jsessionid', 'phpsessid',
  'signature', 'sig', 'token', 'ticket', 'samlresponse', 'assertion',
  'relaystate', 'state',
]);

function isCredentialQueryParam(value: string): boolean {
  return CREDENTIAL_QUERY_PARAMS.has(value.replace(/[^a-z0-9]/gi, '').toLowerCase());
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every(key => allowedKeys.has(key));
}

function isValidAuthentication(value: unknown): value is NonNullable<ScanConfig['authentication']> {
  if (!isPlainRecord(value)) return false;
  return hasOnlyKeys(value, ['authType', 'loginUrl', 'username', 'password'])
    && (value.authType === 'form' || value.authType === 'basic')
    && typeof value.loginUrl === 'string'
    && typeof value.username === 'string'
    && typeof value.password === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidScanConfig(value: unknown): value is ScanConfig {
  if (!isPlainRecord(value)
    || !hasOnlyKeys(value, [
      'maxPages', 'maxDepth', 'concurrency', 'delay', 'excludePatterns',
      'waitForSelector', 'respectRobotsTxt', 'viewport', 'authentication',
      'wcagVersion', 'entitlementTier',
    ])) return false;
  if (!isPlainRecord(value.viewport)
    || !hasOnlyKeys(value.viewport, ['width', 'height'])
    || !isFiniteNumber(value.viewport.width)
    || !isFiniteNumber(value.viewport.height)) return false;
  if (!Array.isArray(value.excludePatterns)
    || !value.excludePatterns.every(pattern => typeof pattern === 'string')) return false;
  if (value.authentication !== null && !isValidAuthentication(value.authentication)) return false;
  if (value.entitlementTier !== undefined
    && value.entitlementTier !== 'anonymous'
    && value.entitlementTier !== 'user'
    && value.entitlementTier !== 'admin') return false;
  return isFiniteNumber(value.maxPages)
    && isFiniteNumber(value.maxDepth)
    && isFiniteNumber(value.concurrency)
    && isFiniteNumber(value.delay)
    && (value.waitForSelector === null || typeof value.waitForSelector === 'string')
    && typeof value.respectRobotsTxt === 'boolean'
    && (value.wcagVersion === '2.1' || value.wcagVersion === '2.2');
}

/** Return true when a URL embeds credentials in its authority component. */
export function urlHasCredentials(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username !== '' || url.password !== '') return true;
    return [...url.searchParams.keys()].some(isCredentialQueryParam);
  } catch {
    return false;
  }
}

/** Strip embedded URL credentials while preserving an otherwise valid URL. */
export function redactUrlCredentials(value: string): string {
  try {
    const url = new URL(value);
    let changed = url.username !== '' || url.password !== '';
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) {
      if (isCredentialQueryParam(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (!changed) return value;
    return url.toString();
  } catch {
    return value;
  }
}

/** Redact credential-bearing HTTP(S) URLs embedded in log/error text. */
export function redactCredentialText(value: string): string {
  return value.replace(
    /https?:\/\/[^\s"'<>(){}]+/gi,
    match => redactUrlCredentials(match),
  );
}

/** True when the config carries a non-empty username or password. */
export function configHasStoredCredentials(config: unknown): boolean {
  if (!isValidScanConfig(config)) return true;
  const auth = config.authentication;
  if (auth === null) return false;
  return (auth.username ?? '') !== ''
    || (auth.password ?? '') !== ''
    || urlHasCredentials(auth.loginUrl);
}

/** Return a copy of the config with any auth credentials emptied. Never mutates the input. */
export function redactScanConfig(config: unknown): ScanConfig {
  if (!isValidScanConfig(config)) return {} as ScanConfig;
  const auth = config.authentication;
  const redacted: ScanConfig = {
    maxPages: config.maxPages,
    maxDepth: config.maxDepth,
    concurrency: config.concurrency,
    delay: config.delay,
    excludePatterns: [...config.excludePatterns],
    waitForSelector: config.waitForSelector,
    respectRobotsTxt: config.respectRobotsTxt,
    viewport: { width: config.viewport.width, height: config.viewport.height },
    authentication: auth === null ? null : {
      authType: auth.authType,
      loginUrl: redactUrlCredentials(auth.loginUrl),
      username: REDACTED,
      password: REDACTED,
    },
    wcagVersion: config.wcagVersion,
  };
  if (config.entitlementTier !== undefined) redacted.entitlementTier = config.entitlementTier;
  return redacted;
}
