import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SharedComponent } from '../../types';
import { REGION_ICONS } from '../../lib/constants';
import { IssueCard } from './IssueCard';

interface SharedComponentsProps {
  components: SharedComponent[];
}

export function SharedComponents({ components }: SharedComponentsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  if (components.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-400">No shared component issues detected.</p>
        <p className="text-sm text-slate-500 mt-1">
          All issues are page-specific.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {components.map((component) => (
        <div key={component.id} className="card">
          <button
            onClick={() => toggleExpand(component.id)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {expanded.has(component.id) ? (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-400" />
              )}
              <span className="text-xl">
                {REGION_ICONS[component.region as keyof typeof REGION_ICONS] || '❓'}
              </span>
              <div className="text-left">
                <h3 className="font-heading font-medium text-white">
                  {component.label}
                </h3>
                <p className="text-sm text-slate-400">
                  Found on {component.pageCount} pages
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                {component.issues.length} issues
              </span>
            </div>
          </button>

          {expanded.has(component.id) && (
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              {component.issues.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No accessibility issues found in this component.
                </p>
              ) : (
                component.issues.map((issue, index) => (
                  <IssueCard
                    key={`${issue.ruleId}-${index}`}
                    issue={issue}
                    showAffectedPages
                  />
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
