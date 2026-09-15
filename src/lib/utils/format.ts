// Number & Currency Formatting Utilities

const TRY_FORMATTER = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_FORMATTER = new Intl.NumberFormat('tr-TR', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

const PERCENT_FORMATTER = new Intl.NumberFormat('tr-TR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number, currency: string = 'TRY'): string {
  if (currency === 'USD') return USD_FORMATTER.format(value);
  return TRY_FORMATTER.format(value);
}

export function formatCompact(value: number): string {
  return COMPACT_FORMATTER.format(value);
}

export function formatPercent(value: number): string {
  return PERCENT_FORMATTER.format(value / 100);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(
  dateStr: string,
  locale: string = 'tr-TR',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(
  dateStr: string,
  locale: string = 'tr-TR'
): string {
  const date = new Date(dateStr);
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateStr: string, locale: string = 'tr'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSec < 60) return rtf.format(-diffSec, 'second');
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  if (diffHour < 24) return rtf.format(-diffHour, 'hour');
  if (diffDay < 30) return rtf.format(-diffDay, 'day');
  if (diffDay < 365) return rtf.format(-Math.floor(diffDay / 30), 'month');
  return rtf.format(-Math.floor(diffDay / 365), 'year');
}

export function getPnLColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function getPnLBgColor(value: number): string {
  if (value > 0) return 'bg-emerald-500/10';
  if (value < 0) return 'bg-red-500/10';
  return 'bg-gray-500/10';
}

export function getPnLSign(value: number): string {
  if (value > 0) return '+';
  return '';
}
