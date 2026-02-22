import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, RefreshCw, Filter } from 'lucide-react';
import { reportApi, scanApi } from '../lib/api';
import { ScoreSummary } from '../components/report/ScoreSummary';
import { SharedComponents } from '../components/report/SharedComponents';
import { PageIssues } from '../components/report/PageIssues';
import type { FullReport, Issue } from '../types';

type TabType = 'shared' | 'pages' | 'rules';
type SeverityFilter = 'critical' | 'serious' | 'moderate' | 'minor';

const SEVERITY_CONFIG: Record<SeverityFilter, { label: string; color: string; bgColor: string; activeBg: string }> = {
  critical: { label: 'Critical', color: 'text-critical', bgColor: 'bg-critical/20', activeBg: 'bg-critical/30 border border-critical/50' },
  serious: { label: 'Serious', color: 'text-serious', bgColor: 'bg-serious/20', activeBg: 'bg-serious/30 border border-serious/50' },
  moderate: { label: 'Moderate', color: 'text-moderate', bgColor: 'bg-moderate/20', activeBg: 'bg-moderate/30 border border-moderate/50' },
  minor: { label: 'Minor', color: 'text-minor', bgColor: 'bg-minor/20', activeBg: 'bg-minor/30 border border-minor/50' },
};

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  const [rescanning, setRescanning] = useState(false);
  // Default: only Critical and Serious (required WCAG fixes)
  const [severityFilters, setSeverityFilters] = useState<Set<SeverityFilter>>(
    new Set(['critical', 'serious'])
  );

  const toggleSeverity = (severity: SeverityFilter) => {
    const newFilters = new Set(severityFilters);
    if (newFilters.has(severity)) {
      newFilters.delete(severity);
    } else {
      newFilters.add(severity);
    }
    setSeverityFilters(newFilters);
  };

  const selectAllSeverities = () => {
    setSeverityFilters(new Set(['critical', 'serious', 'moderate', 'minor']));
  };

  const selectRequiredOnly = () => {
    setSeverityFilters(new Set(['critical', 'serious']));
  };

  const handleRescan = async () => {
    if (!report) return;

    setRescanning(true);
    try {
      const result = await scanApi.create(report.scan.root_url, report.scan.config);
      navigate(`/scans/${result.id}/progress`);
    } catch (err) {
      console.error('Failed to start rescan:', err);
      setRescanning(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    reportApi
      .get(id)
      .then(setReport)
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load report');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Filter issues by severity - must be before early returns
  const filteredReport = useMemo(() => {
    if (!report) return null;

    const filterIssues = (issues: Issue[]) =>
      issues.filter((issue) => severityFilters.has(issue.impact as SeverityFilter));

    const filteredSharedComponents = report.sharedComponents
      .map((comp) => ({
        ...comp,
        issues: filterIssues(comp.issues),
      }))
      .filter((comp) => comp.issues.length > 0);

    const filteredPageIssues = report.pageSpecificIssues
      .map((page) => ({
        ...page,
        issues: filterIssues(page.issues),
        issueCount: filterIssues(page.issues).length,
      }))
      .filter((page) => page.issues.length > 0);

    return {
      sharedComponents: filteredSharedComponents,
      pageSpecificIssues: filteredPageIssues,
    };
  }, [report, severityFilters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="text-center py-16">
        <p className="text-critical mb-4">{error || 'Report not found'}</p>
        <Link to="/" className="btn btn-secondary">
          Go Home
        </Link>
      </div>
    );
  }

  const tabs = [
    {
      id: 'shared' as TabType,
      label: 'Shared Components',
      count: filteredReport?.sharedComponents.length || 0,
    },
    {
      id: 'pages' as TabType,
      label: 'Page-Specific',
      count: filteredReport?.pageSpecificIssues.length || 0,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-white">
              Accessibility Report
            </h1>
            <p className="text-sm text-slate-400">{report.scan.root_url}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRescan}
            disabled={rescanning}
            className="btn btn-primary"
          >
            {rescanning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Rescan
          </button>
          <a
            href={reportApi.exportUrl(report.scan.id)}
            download
            className="btn btn-secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            Export HTML
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-8">
        <ScoreSummary summary={report.summary} />
      </div>

      {/* Tabs & Filter */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-surface p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  activeTab === tab.id
                    ? 'bg-white/20'
                    : 'bg-border'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          <div className="flex items-center gap-1 bg-surface p-1 rounded-lg">
            {(Object.entries(SEVERITY_CONFIG) as [SeverityFilter, typeof SEVERITY_CONFIG[SeverityFilter]][]).map(
              ([severity, config]) => (
                <button
                  key={severity}
                  onClick={() => toggleSeverity(severity)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    severityFilters.has(severity)
                      ? `${config.activeBg} ${config.color}`
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {config.label}
                  {report && (
                    <span className="ml-1 opacity-70">
                      ({report.summary.bySeverity[severity]})
                    </span>
                  )}
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={selectRequiredOnly}
              className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-surface transition-colors"
            >
              Required Only
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={selectAllSeverities}
              className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-surface transition-colors"
            >
              Show All
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'shared' && filteredReport && (
        <SharedComponents components={filteredReport.sharedComponents} />
      )}

      {activeTab === 'pages' && filteredReport && (
        <PageIssues pages={filteredReport.pageSpecificIssues} />
      )}
    </div>
  );
}
