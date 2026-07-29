import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ScanForm } from './ScanForm';
import { AuthContext } from '../../contexts/AuthContext';
import type { EntitlementTier } from '../../types';

function render(props: { defaultShowAdvanced?: boolean } = {}) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <ScanForm {...props} />
    </MemoryRouter>,
  );
}

function renderAs(role: EntitlementTier, props: { defaultShowAdvanced?: boolean } = {}) {
  return renderToStaticMarkup(
    <AuthContext.Provider
      value={{
        state: { authenticated: role !== 'anonymous', role },
        role,
        loading: false,
        configured: false,
        googleReady: false,
        renderGoogleButton: () => {},
        signOut: () => {},
      }}
    >
      <MemoryRouter initialEntries={['/']}>
        <ScanForm {...props} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ScanForm quick-scan limits', () => {
  it('discloses the quick-scan page/depth limits up front (no hidden clamp)', () => {
    const markup = render();

    // The anonymous 10-page / depth-2 limit must be visible before any scan runs.
    expect(markup).toMatch(/up to 10 pages/i);
    expect(markup).toMatch(/2 levels deep/i);

    // Must not advertise a 100-page reach the server will silently clamp.
    expect(markup).not.toMatch(/up to 100 pages/i);
  });

  it('caps the advanced range inputs at the anonymous limits (10 pages / depth 2)', () => {
    const markup = render({ defaultShowAdvanced: true });

    // Max Pages range input is capped at 10, never 50 or 100.
    expect(markup).toMatch(/max="10"/);
    expect(markup).not.toMatch(/max="50"/);
    expect(markup).not.toMatch(/max="100"/);

    // Max Depth range input is capped at 2, never 3 or 5.
    expect(markup).toMatch(/max="2"/);
    expect(markup).not.toMatch(/max="3"/);
    expect(markup).not.toMatch(/max="5"/);

    // The visible end-of-range scale labels reflect the caps, not the old values.
    expect(markup).not.toContain('<span>100</span>');
    expect(markup).not.toContain('<span>5</span>');
  });
});

describe('ScanForm signed-in (user) limits', () => {
  it('discloses the 50-page / depth-3 user reach', () => {
    const markup = renderAs('user');

    expect(markup).toMatch(/up to 50 pages/i);
    expect(markup).toMatch(/3 levels deep/i);
    expect(markup).not.toMatch(/unlimited/i);
  });

  it('caps the advanced range inputs at the user limits (50 pages / depth 3)', () => {
    const markup = renderAs('user', { defaultShowAdvanced: true });

    expect(markup).toContain('max="50"');
    expect(markup).toMatch(/max="3"/);
    expect(markup).not.toContain('max="100"');
  });
});

describe('ScanForm admin unlimited', () => {
  it('honestly says pages are unlimited, never a clamped page number', () => {
    const markup = renderAs('admin');

    expect(markup).toMatch(/unlimited pages/i);
    // Never advertise a finite page cap for the unlimited admin tier.
    expect(markup).not.toMatch(/up to 100 pages/i);
    expect(markup).not.toMatch(/up to 50 pages/i);
    // Depth stays finite/tiered.
    expect(markup).toMatch(/5 levels deep/i);
  });

  it('does not render an invalid numeric page range for the unlimited tier', () => {
    const markup = renderAs('admin', { defaultShowAdvanced: true });

    // No numeric Max Pages slider (min="10" step="10" is unique to it).
    expect(markup).not.toContain('min="10"');
    // The advanced panel labels the page budget as Unlimited instead.
    expect(markup).toMatch(/unlimited/i);
    // The depth slider is still present and capped at 5.
    expect(markup).toMatch(/max="5"/);
  });
});
