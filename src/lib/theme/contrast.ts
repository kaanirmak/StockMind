export interface ThemePaletteTokens {
  mode: 'light' | 'dark';
  bgPrimary: string;
  bgCard: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentSolid: string;
  accentText: string;
  accentSecondary: string;
  semanticSuccess: string;
  semanticDanger: string;
  semanticWarning: string;
  semanticInfo: string;
  chartAxisText: string;
  focusRing: string;
}

export const LIGHT_THEME_TOKENS: ThemePaletteTokens = {
  mode: 'light',
  bgPrimary: '#f8fafc',
  bgCard: '#ffffff',
  bgTertiary: '#f1f5f9',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#475569',
  accentSolid: '#7c3aed',
  accentText: '#6d28d9',
  accentSecondary: '#7e22ce',
  semanticSuccess: '#065f46',
  semanticDanger: '#991b1b',
  semanticWarning: '#854d0e',
  semanticInfo: '#1e40af',
  chartAxisText: '#475569',
  focusRing: '#6d28d9',
};

export const DARK_THEME_TOKENS: ThemePaletteTokens = {
  mode: 'dark',
  bgPrimary: '#000000',
  bgCard: '#12141e',
  bgTertiary: '#141722',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accentSolid: '#7c3aed',
  accentText: '#a78bfa',
  accentSecondary: '#d8b4fe',
  semanticSuccess: '#34d399',
  semanticDanger: '#f87171',
  semanticWarning: '#fbbf24',
  semanticInfo: '#93c5fd',
  chartAxisText: '#94a3b8',
  focusRing: '#a78bfa',
};

export interface ContrastCheckResult {
  id: string;
  foreground: string;
  background: string;
  ratio: number;
  minRequired: number;
  passed: boolean;
}

function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const int = Number.parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function linearizeChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex);
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function auditThemeContrast(tokens: ThemePaletteTokens): ContrastCheckResult[] {
  const pairs: Array<[string, string, string, number]> = [
    ['primary-text-on-bg', tokens.textPrimary, tokens.bgPrimary, 4.5],
    ['primary-text-on-card', tokens.textPrimary, tokens.bgCard, 4.5],
    ['secondary-text-on-card', tokens.textSecondary, tokens.bgCard, 4.5],
    ['muted-text-on-card', tokens.textMuted, tokens.bgCard, 4.5],
    ['muted-text-on-tertiary', tokens.textMuted, tokens.bgTertiary, 4.5],
    ['accent-text-on-card', tokens.accentText, tokens.bgCard, 4.5],
    ['white-on-accent-button', '#ffffff', tokens.accentSolid, 4.5],
    ['success-on-card', tokens.semanticSuccess, tokens.bgCard, 4.5],
    ['danger-on-card', tokens.semanticDanger, tokens.bgCard, 4.5],
    ['warning-on-card', tokens.semanticWarning, tokens.bgCard, 4.5],
    ['info-on-card', tokens.semanticInfo, tokens.bgCard, 4.5],
    ['chart-axis-on-card', tokens.chartAxisText, tokens.bgCard, 4.5],
    ['focus-ring-on-card', tokens.focusRing, tokens.bgCard, 3.0],
    ['focus-ring-on-bg', tokens.focusRing, tokens.bgPrimary, 3.0],
  ];

  return pairs.map(([id, foreground, background, minRequired]) => {
    const ratio = contrastRatio(foreground, background);
    return {
      id,
      foreground,
      background,
      ratio,
      minRequired,
      passed: ratio >= minRequired,
    };
  });
}
