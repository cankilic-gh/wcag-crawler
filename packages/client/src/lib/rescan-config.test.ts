import { describe, expect, it } from 'vitest';
import { configForRescan } from './rescan-config';
import type { ScanConfig } from '../types';

describe('configForRescan', () => {
  it('never replays a persisted redacted authentication object', () => {
    const config = {
      maxPages: 10,
      maxDepth: 2,
      concurrency: 1,
      authentication: {
        authType: 'form',
        loginUrl: 'https://example.com/login',
        username: '',
        password: '',
      },
    } as ScanConfig;

    expect(configForRescan(config)).toEqual(expect.objectContaining({ authentication: null }));
    expect(config.authentication).not.toBeNull();
  });
});
