import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme - Prompty inspired
        background: '#f8f6f1', // Warm cream
        surface: '#ffffff',
        border: '#e8e4dc',
        muted: '#f0ede6',

        // Text colors
        foreground: '#1a1a1a',
        'foreground-muted': '#6b6b6b',

        // Accent colors
        primary: '#1a1a1a', // Dark for buttons
        accent: '#f97316', // Orange accent like Prompty

        // Severity colors (kept for reports)
        critical: '#dc2626',
        serious: '#ea580c',
        moderate: '#ca8a04',
        minor: '#2563eb',
        success: '#16a34a',
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        code: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'float': '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
