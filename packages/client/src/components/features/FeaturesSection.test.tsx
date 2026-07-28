import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeaturesSection } from './FeaturesSection';

describe('FeaturesSection accessibility claims', () => {
  it('describes analysis as automated checks, not full compliance', () => {
    const markup = renderToStaticMarkup(<FeaturesSection />);

    // Must not overstate coverage with a full-compliance claim.
    expect(markup).not.toContain('Full WCAG 2.1 AA compliance');
    expect(markup).not.toMatch(/full\s+WCAG[^<]*compliance/i);

    // Must accurately frame the analysis as automated axe-core checks.
    expect(markup).toContain('Automated axe-core checks');
  });
});
