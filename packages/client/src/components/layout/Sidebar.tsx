import { NavLink } from 'react-router-dom';
import { Home, History, HelpCircle } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'New Scan' },
  { to: '/history', icon: History, label: 'Scan History' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface border-r border-border p-4 overflow-y-auto">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-slate-400 hover:bg-border hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="p-4 rounded-lg bg-background border border-border">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <HelpCircle className="w-4 h-4" />
            <span>Need help?</span>
          </div>
          <p className="text-xs text-slate-500">
            This tool scans websites for WCAG 2.1 AA accessibility issues.
          </p>
        </div>
      </div>
    </aside>
  );
}
