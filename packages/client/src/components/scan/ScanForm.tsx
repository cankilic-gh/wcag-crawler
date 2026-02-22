import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ChevronDown, ChevronUp, Loader2, Shield, CheckCircle2 } from 'lucide-react';
import { scanApi } from '../../lib/api';
import { DEFAULT_SCAN_CONFIG, VIEWPORT_PRESETS } from '../../lib/constants';
import type { ScanConfig } from '../../types';

export function ScanForm() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<Partial<ScanConfig>>({
    maxPages: DEFAULT_SCAN_CONFIG.maxPages,
    maxDepth: DEFAULT_SCAN_CONFIG.maxDepth,
    concurrency: DEFAULT_SCAN_CONFIG.concurrency,
    delay: DEFAULT_SCAN_CONFIG.delay,
    viewport: DEFAULT_SCAN_CONFIG.viewport,
    excludePatterns: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    try {
      const result = await scanApi.create(url, config);
      navigate(`/scans/${result.id}/progress`);
    } catch (err) {
      setError('Failed to start scan. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Website URL
        </label>
        <div className="relative">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="input pl-12 text-lg"
            autoFocus
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-critical">{error}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <span>Advanced Options</span>
      </button>

      {showAdvanced && (
        <div className="card space-y-6">
          {/* WCAG Standard Info */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-white mb-2">Testing Standard: WCAG 2.1 Level AA</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span>WCAG 2.0 Level A</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span>WCAG 2.0 Level AA</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span>WCAG 2.1 Level A</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span>WCAG 2.1 Level AA</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Max Pages
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Maximum number of pages to scan on the website
              </p>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={config.maxPages}
                onChange={(e) => setConfig({ ...config, maxPages: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>10</span>
                <span className="text-primary font-medium">{config.maxPages}</span>
                <span>500</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Max Depth
              </label>
              <p className="text-xs text-slate-500 mb-2">
                How many links deep to crawl from the homepage
              </p>
              <input
                type="range"
                min="1"
                max="10"
                value={config.maxDepth}
                onChange={(e) => setConfig({ ...config, maxDepth: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span className="text-primary font-medium">{config.maxDepth}</span>
                <span>10</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Concurrency
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Number of pages to scan simultaneously
              </p>
              <input
                type="range"
                min="1"
                max="5"
                value={config.concurrency}
                onChange={(e) => setConfig({ ...config, concurrency: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span className="text-primary font-medium">{config.concurrency}</span>
                <span>5</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Delay (ms)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Wait time between page batches (prevents server overload)
              </p>
              <input
                type="number"
                min="0"
                max="5000"
                step="100"
                value={config.delay}
                onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Viewport
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Screen size to use when scanning (affects responsive layouts)
            </p>
            <div className="flex gap-2">
              {VIEWPORT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setConfig({ ...config, viewport: { width: preset.width, height: preset.height } })}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    config.viewport?.width === preset.width
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Exclude Patterns
            </label>
            <p className="text-xs text-slate-500 mb-2">
              URL patterns to skip during crawling (one per line, supports wildcards)
            </p>
            <textarea
              value={config.excludePatterns?.join('\n') || ''}
              onChange={(e) => setConfig({
                ...config,
                excludePatterns: e.target.value.split('\n').filter(Boolean)
              })}
              placeholder="/logout&#10;/api/*&#10;*.pdf"
              className="input h-24 resize-none"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="btn btn-primary w-full py-4 text-lg glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Starting Scan...
          </>
        ) : (
          'Start Accessibility Scan'
        )}
      </button>
    </form>
  );
}
