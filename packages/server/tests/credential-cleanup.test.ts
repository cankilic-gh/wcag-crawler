/**
 * Legacy credential cleanup + read-time non-exposure.
 *
 * Simulates a pre-redaction database row that still holds plaintext
 * credentials, then verifies the startup cleanup strips them idempotently and
 * that detail/report reads never expose credentials.
 */
import { describe, it, expect, beforeAll } from 'vitest';

process.env.DATABASE_PATH = ':memory:';

const { initializeDatabase, getDatabase, cleanupLegacyCredentials } = await import('../src/db/database.js');
const { ScanModel } = await import('../src/models/scan.model.js');
const { PageModel } = await import('../src/models/page.model.js');
const { redactCredentialText, redactScanConfig, redactUrlCredentials, urlHasCredentials } = await import('../src/entitlements/redaction.js');

const LEGACY_USER = 'legacy-user';
const LEGACY_PASS = 'legacy-pass-PLAINTEXT-FIXTURE';

function legacyConfigJson(): string {
  return JSON.stringify({
    maxPages: 50,
    maxDepth: 3,
    concurrency: 3,
    delay: 500,
    excludePatterns: [],
    waitForSelector: null,
    respectRobotsTxt: true,
    viewport: { width: 1280, height: 720 },
    authentication: {
      authType: 'form',
      loginUrl: 'https://example.com/login',
      username: LEGACY_USER,
      password: LEGACY_PASS,
    },
    wcagVersion: '2.1',
  });
}

beforeAll(() => {
  initializeDatabase();
});

describe('redactScanConfig', () => {
  it('empties username/password but keeps authType/loginUrl and does not mutate input', () => {
    const input = JSON.parse(legacyConfigJson());
    const out = redactScanConfig(input);
    expect(out.authentication.username).toBe('');
    expect(out.authentication.password).toBe('');
    expect(out.authentication.authType).toBe('form');
    expect(out.authentication.loginUrl).toBe('https://example.com/login');
    // input untouched
    expect(input.authentication.username).toBe(LEGACY_USER);
  });

  it('leaves a config without authentication unchanged', () => {
    const out = redactScanConfig({
      maxPages: 10, maxDepth: 1, concurrency: 1, delay: 0, excludePatterns: [],
      waitForSelector: null, respectRobotsTxt: true, viewport: { width: 1, height: 1 },
      authentication: null, wcagVersion: '2.1',
    });
    expect(out.authentication).toBeNull();
  });

  it('strips embedded URL userinfo from a persisted login URL', () => {
    const input = JSON.parse(legacyConfigJson());
    input.authentication.loginUrl = 'https://embedded-user:embedded-pass@example.com/login';

    const out = redactScanConfig(input);

    expect(out.authentication.loginUrl).toBe('https://example.com/login');
    expect(JSON.stringify(out)).not.toContain('embedded-user');
    expect(JSON.stringify(out)).not.toContain('embedded-pass');
  });

  it('strips credential-bearing query parameters from a persisted login URL', () => {
    const input = JSON.parse(legacyConfigJson());
    input.authentication.loginUrl = 'https://example.com/login?next=%2Fhome&access_token=query-secret';

    const out = redactScanConfig(input);

    expect(out.authentication.loginUrl).toBe('https://example.com/login?next=%2Fhome');
    expect(JSON.stringify(out)).not.toContain('query-secret');
    expect(JSON.stringify(out)).not.toContain('access_token');
  });

  it('redacts credential-bearing URLs embedded in error text', () => {
    const text = 'Navigation failed for https://example.com/private?token=error-secret&view=full';

    const redacted = redactCredentialText(text);

    expect(redacted).toContain('https://example.com/private?view=full');
    expect(redacted).not.toContain('error-secret');
    expect(redacted).not.toContain('token=');
  });

  it.each([
    'id_token', 'refresh_token', 'ticket', 'SAMLResponse', 'oauth_token', 'key',
    'session_id', 'sessionId', 'authorization_code', 'authorizationCode',
  ])(
    'detects and strips the sensitive %s query parameter',
    key => {
      const url = `https://example.com/callback?view=full&${key}=query-secret`;
      expect(urlHasCredentials(url)).toBe(true);
      expect(redactUrlCredentials(url)).toBe('https://example.com/callback?view=full');
      expect(redactCredentialText(`Failed: ${url}`)).not.toContain('query-secret');
    },
  );

  it.each([
    'plaintext-legacy-auth',
    ['array-secret'],
    { username: 'object-secret-without-valid-shape' },
  ])('fails closed for malformed authentication shape %#', authentication => {
    const output = redactScanConfig({ maxPages: 10, authentication } as never);
    expect(output).toEqual({});
    expect(JSON.stringify(output)).not.toContain('secret');
  });

  it('drops unknown fields from an otherwise valid legacy authentication object', () => {
    const input = JSON.parse(legacyConfigJson());
    input.authentication.refreshToken = 'extra-field-secret';
    const output = redactScanConfig(input);
    expect(output).toEqual({});
    expect(JSON.stringify(output)).not.toContain('extra-field-secret');
  });

  it('redacts credential query values from bracketed IPv6 URLs in error text', () => {
    const redacted = redactCredentialText(
      'Failed https://[2001:4860:4860::8888]/cb?id_token=ipv6-secret&view=full',
    );
    expect(redacted).toContain('https://[2001:4860:4860::8888]/cb?view=full');
    expect(redacted).not.toContain('ipv6-secret');
  });
});

describe('cleanupLegacyCredentials', () => {
  it('redacts scan errors at write, read, and startup-cleanup boundaries', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    const scan = ScanModel.create('https://example.com', JSON.parse(legacyConfigJson()));
    const writeSecret = 'https://example.com/callback?id_token=write-secret&view=full';
    ScanModel.updateStatus(scan.id, 'failed', `Navigation failed: ${writeSecret}`);

    let raw = db.prepare('SELECT error_message FROM scans WHERE id = ?').get(scan.id) as { error_message: string };
    expect(raw.error_message).not.toContain('write-secret');
    expect(ScanModel.findById(scan.id)?.error_message).not.toContain('write-secret');

    const legacySecret = 'https://example.com/callback?refresh_token=legacy-secret&view=full';
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config, error_message) VALUES (?, ?, 'failed', '{}', ?)",
    ).run('scan_legacy_error', 'https://example.com', `Navigation failed: ${legacySecret}`);

    expect(ScanModel.findById('scan_legacy_error')?.error_message).not.toContain('legacy-secret');
    cleanupLegacyCredentials();
    raw = db.prepare('SELECT error_message FROM scans WHERE id = ?').get('scan_legacy_error') as { error_message: string };
    expect(raw.error_message).not.toContain('legacy-secret');
    expect(raw.error_message).toContain('view=full');
  });

  it('fails closed when reading a malformed config inserted after startup cleanup', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'failed', ?)",
    ).run('scan_post_startup_malformed', 'https://example.com', '{malformed-json');

    expect(() => ScanModel.findById('scan_post_startup_malformed')).not.toThrow();
    expect(ScanModel.findById('scan_post_startup_malformed')?.config).toEqual({});
  });

  it('drops and cleans a valid-JSON malformed config with top-level secret fields', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    const malformed = JSON.stringify({
      authentication: null,
      password: 'top-level-probe-secret',
      maxPages: 'not-a-number',
    });
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'failed', ?)",
    ).run('scan_valid_json_malformed', 'https://example.com', malformed);

    expect(ScanModel.findById('scan_valid_json_malformed')?.config).toEqual({});
    expect(JSON.stringify(ScanModel.findAll())).not.toContain('top-level-probe-secret');

    cleanupLegacyCredentials();
    const raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_valid_json_malformed') as { config: string };
    expect(raw.config).toBe('{}');
  });


  it('strips plaintext credentials from existing rows and is idempotent', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'complete', ?)",
    ).run('scan_legacy', 'https://example.com', legacyConfigJson());

    // Precondition: the raw row holds plaintext (a pre-redaction DB).
    let raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_legacy') as { config: string };
    expect(raw.config).toContain(LEGACY_PASS);

    cleanupLegacyCredentials();

    raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_legacy') as { config: string };
    expect(raw.config).not.toContain(LEGACY_PASS);
    expect(raw.config).not.toContain(LEGACY_USER);

    // Idempotent: a second pass does not throw and leaves the row redacted.
    expect(() => cleanupLegacyCredentials()).not.toThrow();
    raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_legacy') as { config: string };
    expect(raw.config).not.toContain(LEGACY_PASS);

    // Detail read never exposes credentials.
    const detail = ScanModel.findById('scan_legacy');
    expect(detail?.config.authentication?.username).toBe('');
    expect(detail?.config.authentication?.password).toBe('');
  });

  it('runs during initializeDatabase without leaving plaintext behind', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'complete', ?)",
    ).run('scan_legacy2', 'https://example.com', legacyConfigJson());

    initializeDatabase();

    const raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_legacy2') as { config: string };
    expect(raw.config).not.toContain(LEGACY_PASS);
    expect(raw.config).not.toContain(LEGACY_USER);
  });

  it('does not crash on a literal null config and strips userinfo from a legacy root URL', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'complete', ?)",
    ).run(
      'scan_malformed',
      'https://root-user:root-pass@example.com/private?token=root-query-secret&view=full',
      'null',
    );
    db.prepare(
      "INSERT INTO pages (id, scan_id, url, status, source_url) VALUES (?, ?, ?, 'complete', ?)",
    ).run(
      'page_legacy_secret',
      'scan_malformed',
      'https://example.com/page?session=page-query-secret&view=full',
      'https://example.com/source?signature=source-query-secret&from=nav',
    );

    expect(() => cleanupLegacyCredentials()).not.toThrow();

    const raw = db.prepare('SELECT root_url, config FROM scans WHERE id = ?').get('scan_malformed') as {
      root_url: string;
      config: string;
    };
    expect(raw.root_url).toBe('https://example.com/private?view=full');
    expect(raw.root_url).not.toContain('root-user');
    expect(raw.root_url).not.toContain('root-pass');
    expect(raw.root_url).not.toContain('root-query-secret');
    const rawPage = db.prepare('SELECT url, source_url FROM pages WHERE id = ?').get('page_legacy_secret') as {
      url: string;
      source_url: string;
    };
    expect(rawPage.url).toBe('https://example.com/page?view=full');
    expect(rawPage.source_url).toBe('https://example.com/source?from=nav');
    expect(ScanModel.findById('scan_malformed')).not.toBeNull();
  });

  it('replaces malformed legacy config instead of retaining embedded plaintext credentials', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    const malformed = '{"authentication":{"username":"malformed-user-secret","password":"malformed-pass-secret"}';
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'complete', ?)",
    ).run('scan_malformed_secret', 'https://example.com', malformed);

    cleanupLegacyCredentials();

    const raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_malformed_secret') as { config: string };
    expect(raw.config).toBe('{}');
    expect(raw.config).not.toContain('malformed-user-secret');
    expect(raw.config).not.toContain('malformed-pass-secret');
  });

  it.each([
    'valid-json-string-secret',
    ['valid-json-array-secret'],
    { username: 'valid-json-object-secret' },
  ])('scrubs valid JSON with malformed authentication shape %#', authentication => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'complete', ?)",
    ).run('scan_malformed_shape', 'https://example.com', JSON.stringify({ authentication }));

    cleanupLegacyCredentials();

    const raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_malformed_shape') as { config: string };
    expect(JSON.parse(raw.config)).toEqual({});
    expect(raw.config).not.toContain('secret');
  });

  it('cleans a valid-JSON malformed config with no authentication key, an ordinary root URL, and no error message', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM scans').run();
    const malformed = JSON.stringify({ password: 'omitted-auth-probe-secret', maxPages: 'bad' });
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config, error_message) VALUES (?, ?, 'complete', ?, NULL)",
    ).run('scan_no_auth_key_malformed', 'https://example.com/ordinary', malformed);

    expect(ScanModel.findById('scan_no_auth_key_malformed')?.config).toEqual({});
    expect(JSON.stringify(ScanModel.findAll())).not.toContain('omitted-auth-probe-secret');

    cleanupLegacyCredentials();

    let raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_no_auth_key_malformed') as { config: string };
    expect(raw.config).toBe('{}');
    expect(raw.config).not.toContain('omitted-auth-probe-secret');

    // Idempotent: a second pass leaves the already-redacted row unchanged.
    cleanupLegacyCredentials();
    raw = db.prepare('SELECT config FROM scans WHERE id = ?').get('scan_no_auth_key_malformed') as { config: string };
    expect(raw.config).toBe('{}');

    expect(ScanModel.findById('scan_no_auth_key_malformed')?.config).toEqual({});
  });

  it('redacts credential-bearing page and source URLs at persistence and read time', () => {
    const db = getDatabase();
    db.exec('DELETE FROM pages; DELETE FROM scans');
    const scan = ScanModel.create('https://example.com', JSON.parse(legacyConfigJson()));
    const page = PageModel.create(
      scan.id,
      'https://example.com/private?token=page-secret&view=full',
      'https://example.com/source?api_key=source-secret&from=nav',
    );

    const raw = db.prepare('SELECT url, source_url FROM pages WHERE id = ?').get(page.id) as {
      url: string;
      source_url: string;
    };
    expect(raw.url).toBe('https://example.com/private?view=full');
    expect(raw.source_url).toBe('https://example.com/source?from=nav');
    expect(JSON.stringify(PageModel.findById(page.id))).not.toContain('secret');
  });
});
