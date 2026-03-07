'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ThemeConfig, ThemePresetId, TenantThemeSettings } from '@shared/types/theme';
import { THEME_PRESETS, DEFAULT_THEME_PRESET } from '@shared/constants/theme-defaults';

interface ThemeContextValue {
  theme: ThemeConfig;
  colorMode: 'light' | 'dark';
  presetId: ThemePresetId;
  setPreset: (id: ThemePresetId) => void;
  setColorMode: (mode: 'light' | 'dark') => void;
  applyOverrides: (overrides: TenantThemeSettings['overrides']) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'theme_preset';
const COLOR_MODE_STORAGE_KEY = 'color_mode';

function injectThemeVariables(theme: ThemeConfig) {
  const root = document.documentElement;

  const colorGroups = ['primary', 'secondary', 'accent', 'danger', 'warning', 'success', 'info', 'neutral'] as const;
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

  for (const group of colorGroups) {
    for (const step of steps) {
      root.style.setProperty(`--color-${group}-${step}`, theme.colors[group][step]);
    }
  }

  root.style.setProperty('--surface-background', theme.surfaces.background);
  root.style.setProperty('--surface-main', theme.surfaces.surface);
  root.style.setProperty('--surface-raised', theme.surfaces.surfaceRaised);
  root.style.setProperty('--surface-overlay', theme.surfaces.surfaceOverlay);
  root.style.setProperty('--surface-border', theme.surfaces.border);
  root.style.setProperty('--surface-border-subtle', theme.surfaces.borderSubtle);

  root.style.setProperty('--text-primary', theme.text.primary);
  root.style.setProperty('--text-secondary', theme.text.secondary);
  root.style.setProperty('--text-muted', theme.text.muted);
  root.style.setProperty('--text-inverse', theme.text.inverse);
  root.style.setProperty('--text-link', theme.text.link);

  root.style.setProperty('--header-bg', theme.headerBg);
  root.style.setProperty('--header-text', theme.headerText);
  root.style.setProperty('--sidebar-bg', theme.sidebarBg);
  root.style.setProperty('--sidebar-text', theme.sidebarText);
  root.style.setProperty('--sidebar-active-bg', theme.sidebarActiveBg);
  root.style.setProperty('--sidebar-active-text', theme.sidebarActiveText);
  root.style.setProperty('--brand-mark', theme.brandMark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [presetId, setPresetId] = useState<ThemePresetId>(DEFAULT_THEME_PRESET);
  const [colorMode, setColorModeState] = useState<'light' | 'dark'>('light');
  const [theme, setTheme] = useState<ThemeConfig>(THEME_PRESETS[DEFAULT_THEME_PRESET]);

  useEffect(() => {
    const storedPreset = localStorage.getItem(THEME_STORAGE_KEY) as ThemePresetId | null;
    const storedMode = localStorage.getItem(COLOR_MODE_STORAGE_KEY) as 'light' | 'dark' | null;

    const resolvedPreset = storedPreset && THEME_PRESETS[storedPreset] ? storedPreset : DEFAULT_THEME_PRESET;
    const resolvedMode = storedMode === 'dark' ? 'dark' : 'light';

    setPresetId(resolvedPreset);
    setColorModeState(resolvedMode);
    setTheme(THEME_PRESETS[resolvedPreset]);
    injectThemeVariables(THEME_PRESETS[resolvedPreset]);

    if (resolvedMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setPreset = useCallback((id: ThemePresetId) => {
    const resolved = THEME_PRESETS[id] ?? THEME_PRESETS[DEFAULT_THEME_PRESET];
    setPresetId(id);
    setTheme(resolved);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    injectThemeVariables(resolved);
  }, []);

  const setColorMode = useCallback((mode: 'light' | 'dark') => {
    setColorModeState(mode);
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const applyOverrides = useCallback((overrides: TenantThemeSettings['overrides']) => {
    if (!overrides) return;
    const root = document.documentElement;
    if (overrides.primaryColor) {
      root.style.setProperty('--color-primary-500', overrides.primaryColor);
    }
    if (overrides.secondaryColor) {
      root.style.setProperty('--color-secondary-500', overrides.secondaryColor);
    }
    if (overrides.accentColor) {
      root.style.setProperty('--color-accent-500', overrides.accentColor);
    }
    if (overrides.headerBg) {
      root.style.setProperty('--header-bg', overrides.headerBg);
    }
    if (overrides.brandMark) {
      root.style.setProperty('--brand-mark', overrides.brandMark);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, colorMode, presetId, setPreset, setColorMode, applyOverrides }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
