import type { ThemeConfig, ThemePresetId } from '../types/theme';

const FEDERAL_BLUE: ThemeConfig = {
  id: 'federal-blue',
  name: 'Federal Blue',
  colorMode: 'light',
  colors: {
    primary: {
      50: '#eef2ff', 100: '#dce4ff', 200: '#b9c9fe', 300: '#8ba5fc',
      400: '#5c7cf8', 500: '#313E8A', 600: '#2B3679', 700: '#1e2a5e',
      800: '#1a2350', 900: '#111840', 950: '#0a0e28',
    },
    secondary: {
      50: '#fdf8ed', 100: '#f9eece', 200: '#f2d88f', 300: '#e9bd4f',
      400: '#dea22a', 500: '#B78B2D', 600: '#9a7225', 700: '#7a5a1e',
      800: '#5d4418', 900: '#413012', 950: '#271c0b',
    },
    accent: {
      50: '#f0f7ff', 100: '#dfeeff', 200: '#b8dbff', 300: '#7ac0ff',
      400: '#33a0ff', 500: '#0080f0', 600: '#0066cc', 700: '#004d99',
      800: '#003a75', 900: '#002952', 950: '#001a36',
    },
    danger: {
      50: '#fef2f0', 100: '#fde0db', 200: '#fcc1b8', 300: '#f89585',
      400: '#f06650', 500: '#C23B22', 600: '#a5321d', 700: '#852818',
      800: '#681f13', 900: '#4d170e', 950: '#330f0a',
    },
    warning: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
      400: '#fbbf24', 500: '#d97706', 600: '#b45309', 700: '#92400e',
      800: '#78350f', 900: '#5c2d0e', 950: '#3d1e09',
    },
    success: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
      400: '#4ade80', 500: '#2D7D46', 600: '#25663a', 700: '#1e5230',
      800: '#183f26', 900: '#132d1c', 950: '#0d1f14',
    },
    info: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
      800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
    },
    neutral: {
      50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
      400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
      800: '#1e293b', 900: '#0f172a', 950: '#020617',
    },
  },
  surfaces: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    surfaceOverlay: 'rgba(15, 23, 42, 0.5)',
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
  },
  text: {
    primary: '#0f172a',
    secondary: '#334155',
    muted: '#64748b',
    inverse: '#ffffff',
    link: '#313E8A',
  },
  headerBg: '#1B2A4A',
  headerText: '#ffffff',
  sidebarBg: '#ffffff',
  sidebarText: '#475569',
  sidebarActiveBg: '#eef2ff',
  sidebarActiveText: '#1e2a5e',
  brandMark: '#B78B2D',
};

const ACCC_NAVY: ThemeConfig = {
  ...FEDERAL_BLUE,
  id: 'accc-navy',
  name: 'ACCC Navy',
  colors: {
    ...FEDERAL_BLUE.colors,
    primary: {
      50: '#f0f4f8', 100: '#d9e2ec', 200: '#bcccdc', 300: '#9fb3c8',
      400: '#829ab1', 500: '#003366', 600: '#002d5a', 700: '#00264d',
      800: '#001f40', 900: '#001833', 950: '#001229',
    },
    secondary: {
      50: '#e6f7f0', 100: '#ccf0e1', 200: '#99e0c3', 300: '#66d1a5',
      400: '#33c187', 500: '#00843D', 600: '#006f34', 700: '#005a2b',
      800: '#004522', 900: '#003019', 950: '#001b0f',
    },
  },
  headerBg: '#003366',
  brandMark: '#00843D',
  text: { ...FEDERAL_BLUE.text, link: '#003366' },
  sidebarActiveBg: '#f0f4f8',
  sidebarActiveText: '#003366',
};

const ASIC_TEAL: ThemeConfig = {
  ...FEDERAL_BLUE,
  id: 'asic-teal',
  name: 'ASIC Teal',
  colors: {
    ...FEDERAL_BLUE.colors,
    primary: {
      50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
      400: '#2dd4bf', 500: '#0d6e6e', 600: '#0b5e5e', 700: '#094e4e',
      800: '#073e3e', 900: '#052e2e', 950: '#031e1e',
    },
  },
  headerBg: '#0d6e6e',
  brandMark: '#d97706',
  text: { ...FEDERAL_BLUE.text, link: '#0d6e6e' },
  sidebarActiveBg: '#f0fdfa',
  sidebarActiveText: '#094e4e',
};

const ACMA_INDIGO: ThemeConfig = {
  ...FEDERAL_BLUE,
  id: 'acma-indigo',
  name: 'ACMA Indigo',
  colors: {
    ...FEDERAL_BLUE.colors,
    primary: {
      50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
      400: '#818cf8', 500: '#4338ca', 600: '#3730a3', 700: '#312e81',
      800: '#292669', 900: '#211e52', 950: '#19163b',
    },
  },
  headerBg: '#312e81',
  brandMark: '#d97706',
  text: { ...FEDERAL_BLUE.text, link: '#4338ca' },
  sidebarActiveBg: '#eef2ff',
  sidebarActiveText: '#312e81',
};

const NEUTRAL_SLATE: ThemeConfig = {
  ...FEDERAL_BLUE,
  id: 'neutral-slate',
  name: 'Neutral Slate',
  colors: {
    ...FEDERAL_BLUE.colors,
    primary: FEDERAL_BLUE.colors.neutral,
  },
  headerBg: '#1e293b',
  brandMark: '#94a3b8',
  text: { ...FEDERAL_BLUE.text, link: '#334155' },
  sidebarActiveBg: '#f1f5f9',
  sidebarActiveText: '#1e293b',
};

export const THEME_PRESETS: Record<ThemePresetId, ThemeConfig> = {
  'federal-blue': FEDERAL_BLUE,
  'accc-navy': ACCC_NAVY,
  'asic-teal': ASIC_TEAL,
  'acma-indigo': ACMA_INDIGO,
  'neutral-slate': NEUTRAL_SLATE,
};

export const DEFAULT_THEME_PRESET: ThemePresetId = 'federal-blue';

export function resolveTheme(presetId: ThemePresetId): ThemeConfig {
  return THEME_PRESETS[presetId] ?? THEME_PRESETS['federal-blue'];
}
