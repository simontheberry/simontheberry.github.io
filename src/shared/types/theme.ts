export interface ThemeColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface SemanticColors {
  primary: ThemeColorScale;
  secondary: ThemeColorScale;
  accent: ThemeColorScale;
  danger: ThemeColorScale;
  warning: ThemeColorScale;
  success: ThemeColorScale;
  info: ThemeColorScale;
  neutral: ThemeColorScale;
}

export interface ThemeSurfaces {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceOverlay: string;
  border: string;
  borderSubtle: string;
}

export interface ThemeText {
  primary: string;
  secondary: string;
  muted: string;
  inverse: string;
  link: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  colorMode: 'light' | 'dark';
  colors: SemanticColors;
  surfaces: ThemeSurfaces;
  text: ThemeText;
  headerBg: string;
  headerText: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  brandMark: string;
}

export interface TenantThemeSettings {
  themePreset: string;
  colorMode: 'light' | 'dark' | 'system';
  overrides: Partial<{
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headerBg: string;
    brandMark: string;
  }>;
}

export type ThemePresetId = 'federal-blue' | 'accc-navy' | 'asic-teal' | 'acma-indigo' | 'neutral-slate';
