import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, ExternalLink, Layers } from 'lucide-react';
import type { PageIssue, Issue } from '../../types';
import { IssueCard } from './IssueCard';

interface PageIssuesProps {
  pages: PageIssue[];
}

interface GroupedPage {
  basePath: string;
  title: string;
  pages: PageIssue[];
  issues: Issue[];
  uniqueIssueCount: number;
}

// Extract base path from URL (without query params)
function getBasePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

// Deduplicate issues by ruleId only - group all violations of same rule
function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Map<string, Issue & { allTargets: string[] }>();
  for (const issue of issues) {
    const key = issue.ruleId;
    if (seen.has(key)) {
      // Add target to existing issue's targets list
      const existing = seen.get(key)!;
      if (issue.target && !existing.allTargets.includes(issue.target)) {
        existing.allTargets.push(issue.target);
      }
    } else {
      seen.set(key, {
        ...issue,
        allTargets: issue.target ? [issue.target] : []
      });
    }
  }
  return Array.from(seen.values());
}

export function PageIssues({ pages }: PageIssuesProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [groupByPath, setGroupByPath] = useState(true);

  // Group pages by base path
  const groupedPages = useMemo(() => {
    if (!groupByPath) {
      return pages.map(page => ({
        basePath: page.url,
        title: page.title || page.url,
        pages: [page],
        issues: page.issues,
        uniqueIssueCount: page.issues.length,
      }));
    }

    const groups = new Map<string, GroupedPage>();

    for (const page of pages) {
      const basePath = getBasePath(page.url);

      if (groups.has(basePath)) {
        const group = groups.get(basePath)!;
        group.pages.push(page);
        group.issues.push(...page.issues);
      } else {
        groups.set(basePath, {
          basePath,
          title: page.title || basePath,
          pages: [page],
          issues: [...page.issues],
          uniqueIssueCount: 0,
        });
      }
    }

    // Deduplicate issues within each group
    for (const group of groups.values()) {
      group.issues = deduplicateIssues(group.issues);
      group.uniqueIssueCount = group.issues.length;
    }

    return Array.from(groups.values());
  }, [pages, groupByPath]);

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpanded(newExpanded);
  };

  if (pages.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-400">No page-specific issues found.</p>
        <p className="text-sm text-slate-500 mt-1">
          All issues are in shared components.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Group toggle */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setGroupByPath(!groupByPath)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            groupByPath
              ? 'bg-primary/20 text-primary'
              : 'bg-surface text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Group similar pages
        </button>
      </div>

      <div className="space-y-2">
        {groupedPages.map((group) => (
          <div key={group.basePath} className="card">
            <button
              onClick={() => toggleExpand(group.basePath)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {expanded.has(group.basePath) ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <FileText className="w-5 h-5 text-slate-500" />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate max-w-md">
                      {group.title}
                    </h3>
                    {group.pages.length > 1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        {group.pages.length} pages
                      </span>
                    )}
                  </div>
                  <a
                    href={group.pages[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-slate-500 hover:text-primary truncate max-w-lg flex items-center gap-1 group"
                  >
                    <span className="truncate">{group.basePath}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                </div>
              </div>

              {(() => {
                const hasCritical = group.issues.some(i => i.impact === 'critical');
                const hasSerious = group.issues.some(i => i.impact === 'serious');
                const hasModerate = group.issues.some(i => i.impact === 'moderate');

                const colorClass = hasCritical
                  ? 'bg-critical/20 text-critical'
                  : hasSerious
                  ? 'bg-serious/20 text-serious'
                  : hasModerate
                  ? 'bg-moderate/20 text-moderate'
                  : 'bg-minor/20 text-minor';

                return (
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${colorClass}`}>
                    {group.uniqueIssueCount} issues
                  </span>
                );
              })()}
            </button>

            {expanded.has(group.basePath) && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                {group.issues.map((issue, index) => (
                  <IssueCard key={`${issue.ruleId}-${issue.target}-${index}`} issue={issue} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
