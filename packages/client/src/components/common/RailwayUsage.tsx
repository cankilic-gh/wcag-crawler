import { useState, useEffect } from 'react';
import { Train, AlertCircle } from 'lucide-react';

interface UsageData {
  creditsRemaining: number;
  daysRemaining: number;
  estimatedUsage: number;
  plan: string;
}

export function RailwayUsage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://wcag-crawler-server-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/system/railway-usage`);
      const data = await response.json();

      if (data.usage) {
        setUsage(data.usage);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch usage');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (error || !usage) {
    return null; // Don't show if there's an error or no data
  }

  // Calculate percentage of credits used
  const totalCredits = 5; // Hobby plan default
  const usedCredits = totalCredits - usage.creditsRemaining;
  const usagePercent = Math.min(100, (usedCredits / totalCredits) * 100);

  // Determine status color
  const getStatusColor = () => {
    if (usagePercent >= 90) return 'text-critical bg-critical/10';
    if (usagePercent >= 70) return 'text-serious bg-serious/10';
    return 'text-success bg-success/10';
  };

  const getBarColor = () => {
    if (usagePercent >= 90) return 'bg-critical';
    if (usagePercent >= 70) return 'bg-serious';
    return 'bg-success';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-surface border border-border rounded-xl shadow-elevated p-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <Train className="w-4 h-4 text-foreground-muted" />
          <span className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
            Railway Usage
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${getBarColor()}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs">
          <span className={`px-2 py-0.5 rounded-full font-medium ${getStatusColor()}`}>
            ${usage.creditsRemaining.toFixed(2)} left
          </span>
          <span className="text-foreground-muted">
            {usage.daysRemaining} days
          </span>
        </div>

        {/* Warning if low */}
        {usagePercent >= 80 && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-serious">
            <AlertCircle className="w-3 h-3" />
            <span>Credits running low</span>
          </div>
        )}
      </div>
    </div>
  );
}
