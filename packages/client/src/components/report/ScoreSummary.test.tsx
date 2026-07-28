import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReportSummary } from '../../types';
import { ScoreSummary } from './ScoreSummary';

const summary: ReportSummary = {
  score: 72,
  totalPages: 3,
  totalIssuesRaw: 12,
  totalIssuesDeduplicated: 6,
  totalRuleTypes: 2,
  bySeverity: {
    critical: 0,
    serious: 8,
    moderate: 4,
    minor: 0,
  },
  ruleCountBySeverity: {
    critical: 0,
    serious: 2,
    moderate: 1,
    minor: 0,
  },
  topRules: [],
};

describe('ScoreSummary metric terminology', () => {
  it('distinguishes deduplicated findings from distinct axe rules', () => {
    const markup = renderToStaticMarkup(<ScoreSummary summary={summary} />);

    expect(markup).toContain('Deduplicated Findings');
    expect(markup).toContain('Rule Types by Severity');
    expect(markup).toContain('2 distinct rules');
    expect(markup).toContain('A rule can appear in more than one severity group');
    expect(markup).not.toContain('2 unique issues');
  });

  it('labels severity groups honestly when an older server omits the distinct-rule total', () => {
    const legacySummary: ReportSummary = {
      ...summary,
      totalRuleTypes: undefined,
    };

    const markup = renderToStaticMarkup(<ScoreSummary summary={legacySummary} />);

    expect(markup).toContain('3 rule groups');
    expect(markup).not.toContain('undefined distinct');
  });
});