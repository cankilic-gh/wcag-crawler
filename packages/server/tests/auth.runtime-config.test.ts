import { describe, expect, it } from 'vitest';
import { resolveAuthRuntimeConfig } from '../src/auth/runtime-config.js';

describe('resolveAuthRuntimeConfig', () => {
  it('fails production startup when identity audience or admin allowlist is missing', () => {
    expect(() => resolveAuthRuntimeConfig({ NODE_ENV: 'production' })).toThrow('GOOGLE_CLIENT_ID');
    expect(() => resolveAuthRuntimeConfig({
      NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'client-id',
    })).toThrow('ADMIN_EMAILS');
  });

  it('normalizes production config and permits an unconfigured local test seam', () => {
    expect(resolveAuthRuntimeConfig({
      NODE_ENV: 'production',
      GOOGLE_CLIENT_ID: ' client-id ',
      ADMIN_EMAILS: ' CANKILIC.MAIL@GMAIL.COM ',
    })).toEqual({ googleClientId: 'client-id', adminEmails: ['cankilic.mail@gmail.com'] });
    expect(resolveAuthRuntimeConfig({ NODE_ENV: 'test' })).toEqual({
      googleClientId: '', adminEmails: [],
    });
  });
});
