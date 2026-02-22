import { useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { useScanStore } from '../../stores/scanStore';
import { useSocket } from '../../hooks/useSocket';
import { ProgressBar } from '../common/ProgressBar';
import type { CrawlPageFoundEvent, ScanProgressEvent, ScanPageCompleteEvent } from '../../types';

interface CrawlProgressProps {
  scanId: string;
}

export function CrawlProgress({ scanId }: CrawlProgressProps) {
  const { joinScan, leaveScan, onEvent } = useSocket();
  const {
    discoveredPages,
    scannedCount,
    totalCount,
    percentage,
    status,
    addDiscoveredPage,
    updatePageStatus,
    updateProgress,
    updateStatus,
  } = useScanStore();

  useEffect(() => {
    joinScan(scanId);

    const cleanups = [
      onEvent<{ status: string }>('scan:status', (data) => {
        updateStatus(data.status);
      }),
      onEvent<CrawlPageFoundEvent>('crawl:page:found', (data) => {
        addDiscoveredPage({
          id: data.url,
          url: data.url,
          title: data.title,
          status: 'pending',
          issueCount: 0,
        });
      }),
      onEvent<{ url: string }>('scan:page:start', (data) => {
        updatePageStatus(data.url, 'scanning');
      }),
      onEvent<ScanPageCompleteEvent>('scan:page:complete', (data) => {
        updatePageStatus(data.url, 'complete', data.issueCount);
      }),
      onEvent<{ url: string }>('scan:page:error', (data) => {
        updatePageStatus(data.url, 'error');
      }),
      onEvent<ScanProgressEvent>('scan:progress', (data) => {
        updateProgress(data.scannedPages, data.totalPages);
      }),
    ];

    return () => {
      leaveScan(scanId);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [scanId]);

  const getStatusIcon = (pageStatus: string) => {
    switch (pageStatus) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-critical" />;
      case 'scanning':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getPhaseLabel = () => {
    switch (status) {
      case 'crawling':
        return 'Discovering pages...';
      case 'scanning':
        return 'Scanning for accessibility issues...';
      case 'analyzing':
        return 'Running smart deduplication...';
      case 'complete':
        return 'Scan complete!';
      case 'failed':
        return 'Scan failed';
      default:
        return 'Starting...';
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Page list */}
      <div className="card h-[500px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-medium">Discovered Pages</h3>
          <span className="text-sm text-slate-400">{totalCount} pages</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {discoveredPages.map((page) => (
            <div
              key={page.url}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors"
            >
              {getStatusIcon(page.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate text-slate-300">
                  {page.title || page.url}
                </p>
                <p className="text-xs text-slate-500 truncate">{page.url}</p>
              </div>
              {page.status === 'complete' && page.issueCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-critical/20 text-critical">
                  {page.issueCount}
                </span>
              )}
            </div>
          ))}

          {discoveredPages.length === 0 && (
            <div className="flex items-center justify-center h-full text-slate-500">
              Waiting for pages...
            </div>
          )}
        </div>
      </div>

      {/* Right: Stats */}
      <div className="space-y-6">
        <div className="card">
          <h3 className="font-heading font-medium mb-4">Scan Progress</h3>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">{getPhaseLabel()}</span>
            </div>
            <ProgressBar value={percentage} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-background">
              <p className="text-2xl font-heading font-bold text-white">{scannedCount}</p>
              <p className="text-sm text-slate-400">Pages Scanned</p>
            </div>
            <div className="p-4 rounded-lg bg-background">
              <p className="text-2xl font-heading font-bold text-white">{totalCount}</p>
              <p className="text-sm text-slate-400">Total Pages</p>
            </div>
          </div>
        </div>

        {/* Phase indicator */}
        <div className="card">
          <h3 className="font-heading font-medium mb-4">Phase</h3>
          <div className="flex items-center justify-between">
            {['crawling', 'scanning', 'analyzing', 'complete'].map((phase, index) => {
              const labels = ['Crawl', 'Scan', 'Analyze', 'Done'];
              const currentIndex = ['crawling', 'scanning', 'analyzing', 'complete'].indexOf(status);
              return (
                <div key={phase} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        status === phase
                          ? 'bg-primary text-white'
                          : currentIndex > index
                          ? 'bg-success text-white'
                          : 'bg-border text-slate-500'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-xs text-slate-500 mt-2">{labels[index]}</span>
                  </div>
                  {index < 3 && (
                    <div
                      className={`flex-1 h-0.5 mx-3 ${
                        currentIndex > index ? 'bg-success' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
