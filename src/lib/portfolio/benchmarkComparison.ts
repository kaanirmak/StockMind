export type BenchmarkId = 'XU100' | 'SP500' | 'NASDAQ' | 'ALTIN' | 'USDTRY';
export type ComparisonCurrency = 'TRY' | 'USD';
export type BenchmarkPeriod = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface BenchmarkDefinition {
  id: BenchmarkId;
  label: string;
  symbol: string;
  exchange: string;
  nativeCurrency: ComparisonCurrency;
}

export const BENCHMARK_OPTIONS: readonly BenchmarkDefinition[] = [
  { id: 'XU100', label: 'BIST 100', symbol: 'XU100', exchange: 'BIST', nativeCurrency: 'TRY' },
  { id: 'SP500', label: 'S&P 500', symbol: '^GSPC', exchange: 'INDEX', nativeCurrency: 'USD' },
  { id: 'NASDAQ', label: 'Nasdaq', symbol: '^IXIC', exchange: 'INDEX', nativeCurrency: 'USD' },
  { id: 'ALTIN', label: 'Altın (Ons)', symbol: 'GC=F', exchange: 'COMMODITY', nativeCurrency: 'USD' },
  { id: 'USDTRY', label: 'USD / TRY', symbol: 'USDTRY', exchange: 'FX', nativeCurrency: 'TRY' },
];

export interface DatedNumericPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface AlignedBenchmarkPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number;
  portfolioIndexed: number;
  benchmarkIndexed: number;
}

export interface BenchmarkComparisonResult {
  comparable: boolean;
  currency: ComparisonCurrency;
  period: BenchmarkPeriod;
  benchmark: BenchmarkDefinition;
  startDate: string | null;
  endDate: string | null;
  portfolioStartIndex: number;
  benchmarkStartIndex: number;
  portfolioReturnPct: number | null;
  benchmarkReturnPct: number | null;
  alphaPct: number | null;
  points: AlignedBenchmarkPoint[];
  missingReason: string | null;
}

function normalizeDate(raw: string): string | null {
  const s = (raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ts = Date.parse(s);
  return Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : null;
}

export function periodDaysCount(period: BenchmarkPeriod): number {
  switch (period) {
    case '1W':
      return 7;
    case '1M':
      return 30;
    case '3M':
      return 90;
    case '6M':
      return 180;
    case '1Y':
      return 365;
  }
}

function buildFxLookup(
  fxSeries: readonly DatedNumericPoint[] | undefined,
  fallbackRate: number | null | undefined
): (date: string) => number | null {
  const sorted = [...(fxSeries ?? [])]
    .map((p) => ({ date: normalizeDate(p.date), value: Number(p.value) }))
    .filter((p): p is { date: string; value: number } => Boolean(p.date) && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const validFallback =
    typeof fallbackRate === 'number' && Number.isFinite(fallbackRate) && fallbackRate > 0
      ? fallbackRate
      : null;

  if (sorted.length === 0) {
    return () => validFallback;
  }

  return (date: string) => {
    let latest: number | null = null;
    for (const row of sorted) {
      if (row.date <= date) latest = row.value;
      else break;
    }
    return latest ?? sorted[0].value ?? validFallback;
  };
}

function normalizeDatedSeries(raw: readonly DatedNumericPoint[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const pt of raw) {
    const date = normalizeDate(pt.date);
    const val = Number(pt.value);
    if (!date || !Number.isFinite(val) || val <= 0) continue;
    map.set(date, val);
  }
  return map;
}

/**
 * Aligns portfolio TRY valuation series against a selected reference benchmark over identical
 * date bounds and currency (TRY or USD), normalizing both series to start identically at 100.
 */
export function buildBenchmarkComparison(input: {
  portfolioTrySeries: readonly DatedNumericPoint[];
  benchmarkId: BenchmarkId;
  benchmarkNativeSeries: readonly DatedNumericPoint[];
  period: BenchmarkPeriod;
  currency: ComparisonCurrency;
  usdTrySeries?: readonly DatedNumericPoint[];
  usdTryFallback?: number | null;
  referenceDate?: string;
}): BenchmarkComparisonResult {
  const benchmark =
    BENCHMARK_OPTIONS.find((b) => b.id === input.benchmarkId) ?? BENCHMARK_OPTIONS[0];
  const emptyBase: BenchmarkComparisonResult = {
    comparable: false,
    currency: input.currency,
    period: input.period,
    benchmark,
    startDate: null,
    endDate: null,
    portfolioStartIndex: 100,
    benchmarkStartIndex: 100,
    portfolioReturnPct: null,
    benchmarkReturnPct: null,
    alphaPct: null,
    points: [],
    missingReason: null,
  };

  const portMap = normalizeDatedSeries(input.portfolioTrySeries);
  const benchMap = normalizeDatedSeries(input.benchmarkNativeSeries);
  if (portMap.size < 2) {
    return {
      ...emptyBase,
      missingReason: 'Seçili dönem için portföy geçmiş serisi henüz yeterli değil.',
    };
  }
  if (benchMap.size < 2) {
    return {
      ...emptyBase,
      missingReason: `${benchmark.label} için seçili dönemde tarihsel seri alınamadı.`,
    };
  }

  const endRef =
    input.referenceDate && normalizeDate(input.referenceDate)
      ? normalizeDate(input.referenceDate)!
      : Array.from(benchMap.keys()).sort().pop()!;
  const startCutoffMs = Date.parse(`${endRef}T12:00:00Z`) - periodDaysCount(input.period) * 86_400_000;
  const startCutoff = new Date(startCutoffMs).toISOString().slice(0, 10);

  const fxLookup = buildFxLookup(input.usdTrySeries, input.usdTryFallback);

  const portDates = Array.from(portMap.keys()).sort();
  const benchDates = Array.from(benchMap.keys())
    .filter((d) => d >= startCutoff && d <= endRef)
    .sort();

  const effectivePortStart = portDates[0];
  const effectivePortEnd = portDates[portDates.length - 1];

  const overlapBenchDates = benchDates.filter(
    (d) => d >= effectivePortStart && d <= effectivePortEnd
  );

  // Carry-forward latest known portfolio value on benchmark trading days
  const getPortTryOn = (date: string): number | null => {
    let val: number | null = null;
    for (const d of portDates) {
      if (d <= date) val = portMap.get(d) ?? val;
      else break;
    }
    return val;
  };

  const converted: { date: string; portfolioValue: number; benchmarkValue: number }[] = [];
  for (const date of overlapBenchDates) {
    const portTry = getPortTryOn(date);
    const benchNative = benchMap.get(date) ?? null;
    if (portTry == null || portTry <= 0 || benchNative == null || benchNative <= 0) continue;

    let fxRate: number | null = null;
    const needsFx =
      input.currency === 'USD' ||
      benchmark.nativeCurrency !== input.currency;
    if (needsFx) {
      fxRate = fxLookup(date);
      if (fxRate == null || fxRate <= 0) {
        return {
          ...emptyBase,
          missingReason: `${input.currency} cinsinden hizalama için USD/TRY kur serisi bulunamadı.`,
        };
      }
    }

    const portfolioValue =
      input.currency === 'TRY' ? portTry : portTry / fxRate!;

    let benchmarkValue = benchNative;
    if (benchmark.nativeCurrency === 'USD' && input.currency === 'TRY') {
      benchmarkValue = benchNative * fxRate!;
    } else if (benchmark.nativeCurrency === 'TRY' && input.currency === 'USD') {
      benchmarkValue = benchNative / fxRate!;
    }

    converted.push({ date, portfolioValue, benchmarkValue });
  }

  if (converted.length < 2) {
    return {
      ...emptyBase,
      missingReason: `Portföy ve ${benchmark.label} verileri seçili dönemde en az 2 ortak işlem gününde kesişmiyor.`,
    };
  }

  const basePort = converted[0].portfolioValue;
  const baseBench = converted[0].benchmarkValue;
  if (basePort <= 0 || baseBench <= 0) {
    return {
      ...emptyBase,
      missingReason: 'Başlangıç seviyesi sıfır olduğu için karşılaştırma normalize edilemedi.',
    };
  }

  const points: AlignedBenchmarkPoint[] = converted.map((pt) => ({
    date: pt.date,
    portfolioValue: Number(pt.portfolioValue.toFixed(2)),
    benchmarkValue: Number(pt.benchmarkValue.toFixed(4)),
    portfolioIndexed: Number(((pt.portfolioValue / basePort) * 100).toFixed(2)),
    benchmarkIndexed: Number(((pt.benchmarkValue / baseBench) * 100).toFixed(2)),
  }));

  const first = points[0];
  const last = points[points.length - 1];
  const portfolioReturnPct = Number((last.portfolioIndexed - 100).toFixed(2));
  const benchmarkReturnPct = Number((last.benchmarkIndexed - 100).toFixed(2));
  const alphaPct = Number((portfolioReturnPct - benchmarkReturnPct).toFixed(2));

  return {
    comparable: true,
    currency: input.currency,
    period: input.period,
    benchmark,
    startDate: first.date,
    endDate: last.date,
    portfolioStartIndex: first.portfolioIndexed,
    benchmarkStartIndex: first.benchmarkIndexed,
    portfolioReturnPct,
    benchmarkReturnPct,
    alphaPct,
    points,
    missingReason: null,
  };
}
