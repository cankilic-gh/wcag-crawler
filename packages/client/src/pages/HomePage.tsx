import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accessibility, Clock } from 'lucide-react';
import { ScanForm } from '../components/scan/ScanForm';
import { scanApi } from '../lib/api';
import type { Scan } from '../types';

export function HomePage() {
  const [recentScans, setRecentScans] = useState<Scan[]>([]);

  useEffect(() => {
    scanApi.list(10).then(setRecentScans).catch(console.error);
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/20 flex items-center justify-center glow-primary">
          <Accessibility className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-heading font-bold text-white mb-4">
          WCAG Crawler
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Scan your entire website for WCAG 2.1 AA accessibility issues with
          smart component deduplication.
        </p>
      </div>

      {/* Scan Form */}
      <div className="card p-8 mb-12">
        <ScanForm />
      </div>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-medium text-white">Recent Scans</h2>
            <Link to="/history" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {recentScans.map((scan) => (
              <Link
                key={scan.id}
                to={
                  scan.status === 'complete'
                    ? `/scans/${scan.id}/report`
                    : `/scans/${scan.id}/progress`
                }
                className="card flex items-center justify-between hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {scan.status === 'complete' ? (
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-heading font-bold ${
                        (scan.score ?? 0) >= 80
                          ? 'bg-success/20 text-success'
                          : (scan.score ?? 0) >= 50
                          ? 'bg-moderate/20 text-moderate'
                          : 'bg-critical/20 text-critical'
                      }`}
                    >
                      {scan.score ?? '—'}
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white truncate max-w-md">
                      {scan.root_url}
                    </p>
                    <p className="text-sm text-slate-500">
                      {scan.total_pages} pages · {scan.total_issues || 0} issues
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-400 capitalize">
                    {scan.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(scan.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
