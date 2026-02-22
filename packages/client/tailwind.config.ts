import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        surface: '#13131a',
        border: '#1e1e2e',
        primary: '#6366f1',
        critical: '#ef4444',
        serious: '#f97316',
        moderate: '#eab308',
        minor: '#3b82f6',
        success: '#22c55e',
      },
      fontFamily: {
        heading: ['JetBrains Mono', 'monospace'],
        body: ['IBM Plex Sans', 'sans-serif'],
        code: ['Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
