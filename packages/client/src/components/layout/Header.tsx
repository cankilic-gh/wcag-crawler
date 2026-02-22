import { Link } from 'react-router-dom';
import { Accessibility } from 'lucide-react';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface/80 backdrop-blur-md border-b border-border z-50">
      <div className="h-full px-6 flex items-center">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Accessibility className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold text-white">WCAG Crawler</h1>
            <p className="text-xs text-slate-400">WCAG 2.1 AA Scanner</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
