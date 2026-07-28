import { describe, expect, it } from 'vitest';
import { countDistinctRuleTypes } from '../src/services/report.service.js';

describe('report rule summary', () => {
  it('counts a rule once when it appears under multiple severities', () => {
    const issues = [
      { axe_rule_id: 'color-contrast', impact: 'serious' as const },
      { axe_rule_id: 'color-contrast', impact: 'moderate' as const },
      { axe_rule_id: 'label', impact: 'critical' as const },
    ];

    expect(countDistinctRuleTypes(issues)).toBe(2);
  });
});
