'use client';

import React from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  THEME_PRESETS,
  getThemePresetDefinition,
} from '@/lib/theme/themeConfig';

export function QuickThemeButton({ className = '' }: { className?: string }) {
  const { resolvedTheme, resolvedPreset, setTheme } = useTheme();
  const activePreset = getThemePresetDefinition(resolvedPreset);

  const cycleTheme = () => {
    const idx = THEME_PRESETS.findIndex((preset) => preset.id === resolvedPreset);
    const next = THEME_PRESETS[(idx + 1) % THEME_PRESETS.length];
    setTheme(next.id, { syncAccent: true });
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Tema değiştir (Aktif: ${activePreset.name})`}
      aria-label={`Tema değiştir, aktif tema ${activePreset.name}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-bg-card/85 hover:bg-bg-card border border-border text-xs font-medium text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer backdrop-blur-md shadow-xs ${className}`}
    >
      {resolvedTheme === 'dark' ? (
        <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
      <span className="hidden sm:inline max-w-[110px] truncate">{activePreset.name}</span>
    </button>
  );
}
