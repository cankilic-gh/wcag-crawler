import { type ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  tags?: string[];
}

export function FeatureCard({
  icon,
  title,
  description,
  tags = [],
}: FeatureCardProps) {
  return (
    <div className="feature-card group">
      {/* Icon */}
      <div className="w-10 h-10 mb-4 text-foreground-muted">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-foreground-muted leading-relaxed mb-4">
        {description}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs text-foreground-muted bg-muted rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
