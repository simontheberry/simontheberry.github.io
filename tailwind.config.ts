import type { Config } from 'tailwindcss';

function semanticColor(name: string) {
  const scale: Record<string, string> = {};
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
  for (const step of steps) {
    scale[step] = `var(--color-${name}-${step})`;
  }
  scale.DEFAULT = `var(--color-${name}-500)`;
  return scale;
}

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Government-ready colour palette (legacy, kept for backward compat)
        gov: {
          blue: {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#313E8A',
            600: '#2B3679',
            700: '#1e2a5e',
            800: '#1a2350',
            900: '#111840',
          },
          navy: '#1B2A4A',
          gold: '#B78B2D',
          red: '#C23B22',
          green: '#2D7D46',
          grey: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
        },
        // Semantic color tokens (CSS variable-driven, customizable per tenant)
        semantic: {
          primary: semanticColor('primary'),
          secondary: semanticColor('secondary'),
          accent: semanticColor('accent'),
          danger: semanticColor('danger'),
          warning: semanticColor('warning'),
          success: semanticColor('success'),
          info: semanticColor('info'),
          neutral: semanticColor('neutral'),
        },
      },
      backgroundColor: {
        page: 'var(--surface-background)',
        surface: 'var(--surface-main)',
        'surface-raised': 'var(--surface-raised)',
        header: 'var(--header-bg)',
        'sidebar-active': 'var(--sidebar-active-bg)',
      },
      textColor: {
        heading: 'var(--text-primary)',
        body: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        inverse: 'var(--text-inverse)',
        link: 'var(--text-link)',
        header: 'var(--header-text)',
        sidebar: 'var(--sidebar-text)',
        'sidebar-active': 'var(--sidebar-active-text)',
      },
      borderColor: {
        DEFAULT: 'var(--surface-border)',
        subtle: 'var(--surface-border-subtle)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in-right': 'slide-in-right 0.3s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['var(--font-heading)', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['var(--font-mono)', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
