import { SEVERITY_COLORS } from '../../lib/constants';

interface SeverityBadgeProps {
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, size = 'sm' }: SeverityBadgeProps) {
  const colors = SEVERITY_COLORS[severity];

  return (
    <span
      className={`badge ${colors.bg} ${colors.text} border ${colors.border} ${
        size === 'md' ? 'px-3 py-1 text-sm' : ''
      }`}
    >
      {severity}
    </span>
  );
}
