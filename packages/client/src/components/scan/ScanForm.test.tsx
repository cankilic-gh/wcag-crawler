import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ScanForm } from './ScanForm';

function render(props: { defaultShowAdvanced?: boolean } = {}) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <ScanForm {...props} />
    </MemoryRouter>,
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
