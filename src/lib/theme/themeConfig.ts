export type ThemePresetId = 'obsidian' | 'terminal' | 'emerald' | 'porcelain' | 'paper';
export type ThemePreference = ThemePresetId | 'system' | 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';
export type AccentPresetId = 'violet' | 'sapphire' | 'emerald' | 'gold' | 'coral';
export type UiDensity = 'comfortable' | 'compact';
export type PnlPaletteMode = 'classic' | 'colorblind';

export interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  subtitle: string;
  description: string;
  mode: ResolvedThemeMode;
  defaultAccent: AccentPresetId;
  previewBg: string;
  previewSurface: string;
  previewText: string;
  previewAccent: string;
  previewPositive: string;
  previewNegative: string;
}

export interface AccentPresetDefinition {
  id: AccentPresetId;
  name: string;
  swatchHex: string;
  darkAccent: string;
  darkAccentHover: string;
  darkAccentText: string;
  lightAccent: string;
  lightAccentHover: string;
  lightAccentText: string;
}

export const THEME_STORAGE_KEY = 'stockmind_theme';
export const ACCENT_STORAGE_KEY = 'stockmind_accent';
export const DENSITY_STORAGE_KEY = 'stockmind_density';
export const PNL_MODE_STORAGE_KEY = 'stockmind_pnl_mode';

export const THEME_PRESETS: readonly ThemePresetDefinition[] = [
  {
    id: 'obsidian',
    name: 'Obsidian Pro',
    subtitle: 'Varsayılan İmza Koyu',
    description: 'Derin lacivert-kömür yüzeyler ve yüksek okunabilirlikli mor vurgu.',
    mode: 'dark',
    defaultAccent: 'violet',
    previewBg: '#080b12',
    previewSurface: '#131b2c',
    previewText: '#f8fafc',
    previewAccent: '#7c3aed',
    previewPositive: '#34d399',
    previewNegative: '#f87171',
  },
  {
    id: 'terminal',
    name: 'Midnight Terminal',
    subtitle: 'Yüksek Kontrast Trading',
    description: 'Ultra keskin grafit zemin ve safir terminal odağı.',
    mode: 'dark',
    defaultAccent: 'sapphire',
    previewBg: '#05070b',
    previewSurface: '#0d131f',
    previewText: '#f8fafc',
    previewAccent: '#2563eb',
    previewPositive: '#34d399',
    previewNegative: '#f87171',
  },
  {
    id: 'emerald',
    name: 'Emerald Institutional',
    subtitle: 'Kurumsal Zümrüt Koyu',
    description: 'Zengin yeşim koyu yüzeyler ile dengeli finansal derinlik.',
    mode: 'dark',
    defaultAccent: 'emerald',
    previewBg: '#06110e',
    previewSurface: '#0e1f1a',
    previewText: '#f0fdf4',
    previewAccent: '#047857',
    previewPositive: '#34d399',
    previewNegative: '#f87171',
  },
  {
    id: 'porcelain',
    name: 'Daylight Porcelain',
    subtitle: 'Net Gündüz Modu',
    description: 'Pürüzsüz beyaz kartlar ve serin porselen zemin.',
    mode: 'light',
    defaultAccent: 'violet',
    previewBg: '#f8fafc',
    previewSurface: '#ffffff',
    previewText: '#0f172a',
    previewAccent: '#7c3aed',
    previewPositive: '#065f46',
    previewNegative: '#991b1b',
  },
  {
    id: 'paper',
    name: 'Warm Paper Editorial',
    subtitle: 'Editoryal Kâğıt Modu',
    description: 'Göz yormayan sıcak krem kâğıt dokusu ve kehribar vurgular.',
    mode: 'light',
    defaultAccent: 'gold',
    previewBg: '#faf6ef',
    previewSurface: '#fffdf9',
    previewText: '#1c1917',
    previewAccent: '#b45309',
    previewPositive: '#065f46',
    previewNegative: '#991b1b',
  },
] as const;

export const ACCENT_PRESETS: readonly AccentPresetDefinition[] = [
  {
    id: 'violet',
    name: 'Mor (StockMind)',
    swatchHex: '#7c3aed',
    darkAccent: '#7c3aed',
    darkAccentHover: '#6d28d9',
    darkAccentText: '#a78bfa',
    lightAccent: '#7c3aed',
    lightAccentHover: '#6d28d9',
    lightAccentText: '#6d28d9',
  },
  {
    id: 'sapphire',
    name: 'Safir Mavi',
    swatchHex: '#2563eb',
    darkAccent: '#2563eb',
    darkAccentHover: '#1d4ed8',
    darkAccentText: '#60a5fa',
    lightAccent: '#1d4ed8',
    lightAccentHover: '#1e40af',
    lightAccentText: '#1d4ed8',
  },
  {
    id: 'emerald',
    name: 'Zümrüt Yeşil',
    swatchHex: '#047857',
    darkAccent: '#047857',
    darkAccentHover: '#065f46',
    darkAccentText: '#34d399',
    lightAccent: '#047857',
    lightAccentHover: '#065f46',
    lightAccentText: '#065f46',
  },
  {
    id: 'gold',
    name: 'Altın Kehribar',
    swatchHex: '#b45309',
    darkAccent: '#b45309',
    darkAccentHover: '#92400e',
    darkAccentText: '#fbbf24',
    lightAccent: '#b45309',
    lightAccentHover: '#92400e',
    lightAccentText: '#92400e',
  },
  {
    id: 'coral',
    name: 'Mercan Turuncu',
    swatchHex: '#c2410c',
    darkAccent: '#c2410c',
    darkAccentHover: '#9a3412',
    darkAccentText: '#fb923c',
    lightAccent: '#c2410c',
    lightAccentHover: '#9a3412',
    lightAccentText: '#9a3412',
  },
] as const;

const THEME_PRESET_MAP = new Map<ThemePresetId, ThemePresetDefinition>(
  THEME_PRESETS.map((preset) => [preset.id, preset])
);

const ACCENT_PRESET_MAP = new Map<AccentPresetId, AccentPresetDefinition>(
  ACCENT_PRESETS.map((preset) => [preset.id, preset])
);

export function normalizeThemePreference(raw: string | null | undefined): ThemePresetId | 'system' {
  if (raw === 'system') return 'system';
  if (raw === 'light') return 'porcelain';
  if (raw === 'dark') return 'obsidian';
  if (raw && THEME_PRESET_MAP.has(raw as ThemePresetId)) {
    return raw as ThemePresetId;
  }
  return 'obsidian';
}

export function normalizeAccentPreset(raw: string | null | undefined): AccentPresetId {
  if (raw && ACCENT_PRESET_MAP.has(raw as AccentPresetId)) {
    return raw as AccentPresetId;
  }
  return 'violet';
}

export function normalizeUiDensity(raw: string | null | undefined): UiDensity {
  return raw === 'compact' ? 'compact' : 'comfortable';
}

export function normalizePnlPaletteMode(raw: string | null | undefined): PnlPaletteMode {
  return raw === 'colorblind' ? 'colorblind' : 'classic';
}

export function getThemePresetDefinition(id: ThemePresetId): ThemePresetDefinition {
  return THEME_PRESET_MAP.get(id) ?? THEME_PRESETS[0];
}

export function getAccentPresetDefinition(id: AccentPresetId): AccentPresetDefinition {
  return ACCENT_PRESET_MAP.get(id) ?? ACCENT_PRESETS[0];
}

export function resolveThemeSelection(
  preference: ThemePreference | string | null | undefined,
  systemPrefersDark: boolean
): {
  storedPreference: ThemePresetId | 'system';
  preset: ThemePresetId;
  mode: ResolvedThemeMode;
} {
  const storedPreference = normalizeThemePreference(preference);
  if (storedPreference === 'system') {
    const preset: ThemePresetId = systemPrefersDark ? 'obsidian' : 'porcelain';
    return {
      storedPreference,
      preset,
      mode: systemPrefersDark ? 'dark' : 'light',
    };
  }
  const def = getThemePresetDefinition(storedPreference);
  return {
    storedPreference,
    preset: def.id,
    mode: def.mode,
  };
}
