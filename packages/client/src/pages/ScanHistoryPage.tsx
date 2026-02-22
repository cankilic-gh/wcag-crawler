import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { scanApi } from '../lib/api';
import { EmptyState } from '../components/common/EmptyState';
import type { Scan } from '../types';

export function ScanHistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = () => {
    setLoading(true);
    scanApi
      .list(100)
      .then((data) => {
        if (Array.isArray(data)) {
          setScans(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scan?')) return;

    try {
      await scanApi.delete(id);
      setScans(scans.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Failed to delete scan:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-white mb-6">
        Scan History
      </h1>

      {scans.length === 0 ? (
        <EmptyState
          icon={<ExternalLink className="w-8 h-8" />}
          title="No scans yet"
          description="Start a new scan to see your history here."
          action={
            <Link to="/" className="btn btn-primary">
              Start New Scan
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  URL
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                  Score
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                  Pages
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                  Issues
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                  Date
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr
                  key={scan.id}
                  className="border-b border-border/50 hover:bg-background/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <Link
                      to={
                        scan.status === 'complete'
                          ? `/scans/${scan.id}/report`
                          : `/scans/${scan.id}/progress`
                      }
                      className="text-white hover:text-primary transition-colors truncate block max-w-xs"
                    >
                      {scan.root_url}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {scan.status === 'complete' && scan.score !== null ? (
                      <span
                        className={`font-heading font-bold ${
                          scan.score >= 80
                            ? 'text-success'
                            : scan.score >= 50
                            ? 'text-moderate'
                            : 'text-critical'
                        }`}
                      >
                        {scan.score}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">
                    {scan.total_pages}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">
                    {scan.total_issues || 0}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded capitalize ${
                        scan.status === 'complete'
                          ? 'bg-success/20 text-success'
                          : scan.status === 'failed'
                          ? 'bg-critical/20 text-critical'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {scan.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-slate-400">
                    {formatDate(scan.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDelete(scan.id)}
                      className="p-2 rounded-lg hover:bg-critical/20 text-slate-400 hover:text-critical transition-colors"
                      title="Delete scan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
