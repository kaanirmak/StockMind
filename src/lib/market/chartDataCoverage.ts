export interface ChartDataCoverageInput {
  timeframe: string;
  currency?: string | null;
  isIndex?: boolean;
  candles: ReadonlyArray<{ time: string | number; close?: number }>;
  loading?: boolean;
  error?: string | null;
  source?: string | null;
}

export type ChartCoverageStatus = 'loading' | 'missing' | 'partial' | 'complete';

export interface ChartDataCoverageReport {
  timeframeLabel: string;
  priceUnitLabel: string;
  candleCount: number;
  firstCandleTime: string | null;
  lastCandleTime: string | null;
  rangeSummary: string;
  coverageStatus: ChartCoverageStatus;
  missingDataNotice: string | null;
}

const TIMEFRAME_LABELS: Record<string, string> = {
  '1D': '1G (Gün İçi)',
  '1W': '1H (1 Hafta)',
  '1M': '1A (1 Ay)',
  '3M': '3A (3 Ay)',
  '6M': '6A (6 Ay)',
  '1Y': '1Y (1 Yıl)',
  '5Y': '5Y (5 Yıl)',
  ALL: 'Tümü',
};

const EXPECTED_MIN_CANDLES: Record<string, number> = {
  '1D': 2,
  '1W': 3,
  '1M': 10,
  '3M': 20,
  '6M': 40,
  '1Y': 80,
  '5Y': 100,
  ALL: 60,
};

export function formatCandleTimestamp(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
  return text;
}

export function formatPriceUnitLabel(currency?: string | null, isIndex?: boolean): string {
  if (isIndex) return 'Endeks Puanı (Puan)';
  const code = (currency || 'TRY').trim().toUpperCase();
  if (code === 'TRY') return 'TRY (₺)';
  if (code === 'USD') return 'USD ($)';
  if (code === 'EUR') return 'EUR (€)';
  if (code === 'GBP') return 'GBP (£)';
  return code;
}

export function buildChartDataCoverageReport(
  input: ChartDataCoverageInput
): ChartDataCoverageReport {
  const tf = (input.timeframe || '1Y').toUpperCase();
  const timeframeLabel = TIMEFRAME_LABELS[tf] || tf;
  const priceUnitLabel = formatPriceUnitLabel(input.currency, input.isIndex);
  const candles = Array.isArray(input.candles) ? input.candles : [];
  const candleCount = candles.length;

  const firstCandleTime = candleCount > 0 ? formatCandleTimestamp(candles[0].time) : null;
  const lastCandleTime =
    candleCount > 0 ? formatCandleTimestamp(candles[candleCount - 1].time) : null;

  const rangeSummary =
    firstCandleTime && lastCandleTime
      ? firstCandleTime === lastCandleTime
        ? firstCandleTime
        : `${firstCandleTime} – ${lastCandleTime}`
      : 'Tarih aralığı yok';

  if (input.loading && candleCount === 0) {
    return {
      timeframeLabel,
      priceUnitLabel,
      candleCount,
      firstCandleTime,
      lastCandleTime,
      rangeSummary,
      coverageStatus: 'loading',
      missingDataNotice: null,
    };
  }

  if (input.error || candleCount === 0) {
    return {
      timeframeLabel,
      priceUnitLabel,
      candleCount,
      firstCandleTime,
      lastCandleTime,
      rangeSummary,
      coverageStatus: 'missing',
      missingDataNotice:
        input.error || `${timeframeLabel} aralığı için mum verisi bulunamadı.`,
    };
  }

  const expectedMin = EXPECTED_MIN_CANDLES[tf] ?? 5;
  if (candleCount < expectedMin) {
    return {
      timeframeLabel,
      priceUnitLabel,
      candleCount,
      firstCandleTime,
      lastCandleTime,
      rangeSummary,
      coverageStatus: 'partial',
      missingDataNotice: `${timeframeLabel} için kısmi geçmiş veri mevcut (${candleCount} mum).`,
    };
  }

  return {
    timeframeLabel,
    priceUnitLabel,
    candleCount,
    firstCandleTime,
    lastCandleTime,
    rangeSummary,
    coverageStatus: 'complete',
    missingDataNotice: null,
  };
}
