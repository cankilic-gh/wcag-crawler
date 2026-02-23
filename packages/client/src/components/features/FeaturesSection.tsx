import {
  Layers,
  Zap,
  FileSearch,
  BarChart3,
  Shield,
  Repeat,
} from 'lucide-react';
import { FeatureCard } from './FeatureCard';

const features = [
  {
    icon: <Layers className="w-6 h-6" />,
    title: 'Smart Deduplication',
    description:
      'Automatically identifies and groups similar components across your site, reducing redundant issue reports.',
    tags: ['AI-POWERED', 'COMPONENTS'],
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Lightning Fast',
    description:
      'Concurrent crawling with intelligent throttling ensures rapid scans without overwhelming your server.',
    tags: ['PERFORMANCE', 'SPEED'],
  },
  {
    icon: <FileSearch className="w-6 h-6" />,
    title: 'Deep Analysis',
    description:
      'Full WCAG 2.1 AA compliance checking with detailed remediation guidance for every issue found.',
    tags: ['WCAG 2.1', 'DETAILED'],
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Visual Reports',
    description:
      'Beautiful, shareable reports with severity breakdowns, trend analysis, and actionable insights.',
    tags: ['REPORTS', 'INSIGHTS'],
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Privacy First',
    description:
      'All scans run in isolated environments. Your data never leaves your control.',
    tags: ['SECURITY', 'PRIVACY'],
  },
  {
    icon: <Repeat className="w-6 h-6" />,
    title: 'Continuous Monitoring',
    description:
      'Schedule recurring scans to track accessibility improvements over time.',
    tags: ['MONITORING', 'SCHEDULE'],
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16">
      {/* Section header */}
      <div className="text-center mb-12">
        <span className="inline-block px-3 py-1 text-xs font-medium text-accent bg-accent/10 rounded-full mb-4">
          FEATURES
        </span>
        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3">
          Built for Modern Web
        </h2>
        <p className="text-foreground-muted max-w-xl mx-auto">
          Enterprise-grade accessibility testing with intelligent automation
          and beautiful visualizations.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            tags={feature.tags}
          />
        ))}
      </div>
    </section>
  );
}
