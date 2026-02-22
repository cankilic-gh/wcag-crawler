import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Code2, Copy, Check, Lightbulb, ArrowRight, FileText } from 'lucide-react';
import type { Issue } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';
import { getFixSuggestion } from '../../lib/fixSuggestions';

interface IssueCardProps {
  issue: Issue;
  showAffectedPages?: boolean;
}

// Parse failure summary into structured fixes
function parseFixSuggestions(summary: string): string[] {
  if (!summary) return [];

  // Split by common separators
  const fixes = summary
    .replace(/Fix (any|all) of the following:/gi, '')
    .split(/(?:\r?\n|;|\.(?=\s+[A-Z]))/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  return fixes.length > 0 ? fixes : [summary];
}

export function IssueCard({ issue, showAffectedPages = false }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPages, setShowPages] = useState(false);

  const copySelector = async () => {
    if (issue.target) {
      await navigator.clipboard.writeText(issue.target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fixes = parseFixSuggestions(issue.failureSummary || '');

  return (
    <div
      className={`rounded-lg bg-background border-l-4 overflow-hidden ${
        issue.impact === 'critical'
          ? 'border-l-critical'
          : issue.impact === 'serious'
          ? 'border-l-serious'
          : issue.impact === 'moderate'
          ? 'border-l-moderate'
          : 'border-l-minor'
      }`}
    >
      {/* Header - Always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {issue.helpUrl ? (
                <a
                  href={issue.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-heading font-medium text-white hover:text-primary transition-colors underline decoration-slate-600 hover:decoration-primary"
                >
                  {issue.ruleId}
                </a>
              ) : (
                <span className="font-heading font-medium text-white">
                  {issue.ruleId}
                </span>
              )}
              <SeverityBadge severity={issue.impact} />
              {showAffectedPages && issue.affectedPages && (
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                  {issue.affectedPages} pages
                </span>
              )}
            </div>

            <p className="text-sm text-slate-300 mb-3">{issue.description}</p>

            <div className="flex flex-wrap items-center gap-3">
              {issue.wcagCriteria.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">WCAG:</span>
                  {issue.wcagCriteria.map((criterion) => (
                    <span
                      key={criterion}
                      className="text-xs px-1.5 py-0.5 rounded bg-border text-slate-300 font-medium"
                    >
                      {criterion}
                    </span>
                  ))}
                </div>
              )}

              {(issue.allTargets?.length || issue.target) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Code2 className="w-3 h-3 text-slate-500" />
                  {(issue.allTargets && issue.allTargets.length > 1) ? (
                    // Multiple targets - show as list
                    <>
                      {issue.allTargets.slice(0, 3).map((t, i) => (
                        <code key={i} className="font-code text-xs text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                          {t}
                        </code>
                      ))}
                      {issue.allTargets.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{issue.allTargets.length - 3} more
                        </span>
                      )}
                    </>
                  ) : (
                    // Single target
                    <div className="flex items-center gap-1.5 group">
                      <code className="font-code text-xs text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                        {issue.target}
                      </code>
                      <button
                        onClick={copySelector}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface rounded"
                        title="Copy selector"
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-success" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {issue.helpUrl && (
              <a
                href={issue.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-surface transition-colors"
                title="Learn more on Deque University"
              >
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
              title={expanded ? 'Hide details' : 'Show details'}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (() => {
        const fixSuggestion = getFixSuggestion(issue.ruleId);
        return (
          <div className="border-t border-border">
            {/* Problem & Solution */}
            {fixSuggestion && (
              <div className="p-4 bg-surface/50">
                <div className="mb-3">
                  <span className="text-xs font-medium text-red-400 uppercase tracking-wide">Problem</span>
                  <p className="text-sm text-slate-300 mt-1">{fixSuggestion.problem}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-green-400 uppercase tracking-wide">Solution</span>
                  <p className="text-sm text-slate-300 mt-1">{fixSuggestion.solution}</p>
                </div>
              </div>
            )}

            {/* Your Code */}
            {issue.htmlSnippet && (
              <div className="p-4 bg-[#0a0a0f] border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Your Code
                  </span>
                </div>
                <pre className="text-xs font-code text-slate-400 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                  {issue.htmlSnippet}
                </pre>
              </div>
            )}

            {/* Before / After Examples */}
            {fixSuggestion && (
              <div className="border-t border-border">
                <div className="grid grid-cols-2 divide-x divide-border">
                  {/* Before */}
                  <div className="p-4 bg-red-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                        Before (Wrong)
                      </span>
                    </div>
                    <pre className="text-xs font-code text-slate-400 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {fixSuggestion.before}
                    </pre>
                  </div>

                  {/* After */}
                  <div className="p-4 bg-green-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
                        After (Correct)
                      </span>
                    </div>
                    <pre className="text-xs font-code text-slate-300 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {fixSuggestion.after}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback: Original fix suggestions if no database entry */}
            {!fixSuggestion && fixes.length > 0 && (
              <div className="p-4 bg-amber-500/5 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                    How to Fix
                  </span>
                </div>
                <ul className="space-y-2">
                  {fixes.map((fix, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Affected Pages - Collapsible */}
            {issue.affectedPageUrls && issue.affectedPageUrls.length > 0 && (
              <div className="border-t border-border">
                <button
                  onClick={() => setShowPages(!showPages)}
                  className="w-full p-4 flex items-center justify-between hover:bg-surface/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      Affected Pages
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">
                      {issue.affectedPageUrls.length}
                    </span>
                  </div>
                  {showPages ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showPages && (
                  <div className="px-4 pb-4 space-y-1 max-h-64 overflow-y-auto">
                    {issue.affectedPageUrls.map((url, i) => {
                      // Extract path from URL for display
                      let displayPath = url;
                      try {
                        const parsed = new URL(url);
                        displayPath = parsed.pathname + parsed.search;
                      } catch {
                        // Use full URL if parsing fails
                      }

                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-surface transition-colors group"
                        >
                          <span className="truncate flex-1">{displayPath}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
