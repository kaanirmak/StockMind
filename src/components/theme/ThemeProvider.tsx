'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ACCENT_STORAGE_KEY,
  DENSITY_STORAGE_KEY,
  PNL_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  getThemePresetDefinition,
  normalizeAccentPreset,
  normalizePnlPaletteMode,
  normalizeThemePreference,
  normalizeUiDensity,
  resolveThemeSelection,
  type AccentPresetId,
  type PnlPaletteMode,
  type ResolvedThemeMode,
  type ThemePreference,
  type ThemePresetId,
  type UiDensity,
} from '@/lib/theme/themeConfig';

export type Theme = ThemePreference;
export type ResolvedTheme = ResolvedThemeMode;

interface SetThemeOptions {
  syncAccent?: boolean;
}

interface ThemeContextType {
  theme: ThemePresetId | 'system';
  resolvedTheme: ResolvedTheme;
  resolvedPreset: ThemePresetId;
  accent: AccentPresetId;
  density: UiDensity;
  pnlMode: PnlPaletteMode;
  setTheme: (theme: Theme, options?: SetThemeOptions) => void;
  setAccent: (accent: AccentPresetId) => void;
  setDensity: (density: UiDensity) => void;
  setPnlMode: (mode: PnlPaletteMode) => void;
  toggleTheme: () => void;
  resetAppearance: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyDocumentThemeState(params: {
  mode: ResolvedTheme;
  preset: ThemePresetId;
  accent: AccentPresetId;
  density: UiDensity;
  pnlMode: PnlPaletteMode;
}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(params.mode);
  root.dataset.theme = params.preset;
  root.dataset.accent = params.accent;
  root.dataset.density = params.density;
  root.dataset.pnl = params.pnlMode;
  root.style.colorScheme = params.mode;

  let metaTag = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.name = 'color-scheme';
    document.head.appendChild(metaTag);
  }
  metaTag.content = params.mode;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) {
    const bg = getComputedStyle(root).getPropertyValue('--bg-primary').trim();
    if (bg) themeColor.content = bg;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePresetId | 'system'>('obsidian');
  const [accent, setAccentState] = useState<AccentPresetId>('violet');
  const [density, setDensityState] = useState<UiDensity>('comfortable');
  const [pnlMode, setPnlModeState] = useState<PnlPaletteMode>('classic');
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemPrefersDark(media.matches);

      const storedTheme = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
      setThemeState(storedTheme);

      const resolved = resolveThemeSelection(storedTheme, media.matches);
      const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (storedAccent) {
        setAccentState(normalizeAccentPreset(storedAccent));
      } else {
        setAccentState(getThemePresetDefinition(resolved.preset).defaultAccent);
      }

      setDensityState(normalizeUiDensity(localStorage.getItem(DENSITY_STORAGE_KEY)));
      setPnlModeState(normalizePnlPaletteMode(localStorage.getItem(PNL_MODE_STORAGE_KEY)));
    } catch {
      setThemeState('obsidian');
      setAccentState('violet');
      setDensityState('comfortable');
      setPnlModeState('classic');
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemeState(normalizeThemePreference(event.newValue));
      } else if (event.key === ACCENT_STORAGE_KEY && event.newValue) {
        setAccentState(normalizeAccentPreset(event.newValue));
      } else if (event.key === DENSITY_STORAGE_KEY) {
        setDensityState(normalizeUiDensity(event.newValue));
      } else if (event.key === PNL_MODE_STORAGE_KEY) {
        setPnlModeState(normalizePnlPaletteMode(event.newValue));
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const resolved = useMemo(
    () => resolveThemeSelection(theme, systemPrefersDark),
    [theme, systemPrefersDark]
  );

  useEffect(() => {
    if (!mounted) return;
    applyDocumentThemeState({
      mode: resolved.mode,
      preset: resolved.preset,
      accent,
      density,
      pnlMode,
    });
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(ACCENT_STORAGE_KEY, accent);
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
      localStorage.setItem(PNL_MODE_STORAGE_KEY, pnlMode);
    } catch {}
  }, [mounted, theme, resolved.mode, resolved.preset, accent, density, pnlMode]);

  const setTheme = useCallback((newTheme: Theme, options?: SetThemeOptions) => {
    const normalized = normalizeThemePreference(newTheme);
    setThemeState(normalized);
    if (options?.syncAccent && normalized !== 'system') {
      setAccentState(getThemePresetDefinition(normalized).defaultAccent);
    }
  }, []);

  const setAccent = useCallback((newAccent: AccentPresetId) => {
    setAccentState(normalizeAccentPreset(newAccent));
  }, []);

  const setDensity = useCallback((newDensity: UiDensity) => {
    setDensityState(normalizeUiDensity(newDensity));
  }, []);

  const setPnlMode = useCallback((newMode: PnlPaletteMode) => {
    setPnlModeState(normalizePnlPaletteMode(newMode));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const current = resolveThemeSelection(prev, systemPrefersDark);
      return current.mode === 'dark' ? 'porcelain' : 'obsidian';
    });
  }, [systemPrefersDark]);

  const resetAppearance = useCallback(() => {
    setThemeState('obsidian');
    setAccentState('violet');
    setDensityState('comfortable');
    setPnlModeState('classic');
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme: resolved.mode,
        resolvedPreset: resolved.preset,
        accent,
        density,
        pnlMode,
        setTheme,
        setAccent,
        setDensity,
        setPnlMode,
        toggleTheme,
        resetAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'obsidian' as const,
      resolvedTheme: 'dark' as ResolvedTheme,
      resolvedPreset: 'obsidian' as ThemePresetId,
      accent: 'violet' as AccentPresetId,
      density: 'comfortable' as UiDensity,
      pnlMode: 'classic' as PnlPaletteMode,
      setTheme: () => {},
      setAccent: () => {},
      setDensity: () => {},
      setPnlMode: () => {},
      toggleTheme: () => {},
      resetAppearance: () => {},
    };
  }
  return context;
}
