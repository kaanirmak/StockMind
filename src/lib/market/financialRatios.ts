import type {
  FinancialStatementPeriod,
  FinancialStatementsReport,
  StatementPeriodType,
} from '@/lib/market/financialStatements';

export type FinancialRatioUnit = 'percent' | 'multiple' | 'currency';

export interface FinancialRatioRow {
  key: string;
  label: string;
  category: 'profitability' | 'leverage' | 'liquidity' | 'cashflow';
  unit: FinancialRatioUnit;
  formula: string;
  methodNote: string;
  values: Record<string, number | null>;
}

export interface ValuationSnapshotMetric {
  key: 'trailingPE' | 'forwardPE' | 'priceToBook';
  label: string;
  value: number | null;
  formula: string;
  methodNote: string;
}

export interface FinancialRatioHistoryReport {
  symbol: string;
  periodType: StatementPeriodType;
  currency: string;
  periods: FinancialStatementPeriod[];
  rows: FinancialRatioRow[];
  valuationMetrics: ValuationSnapshotMetric[];
  hasAnyRatio: boolean;
  notice: string | null;
}

function getRowValueMap(
  section: { rows: Array<{ key: string; values: Record<string, number | null> }> } | undefined,
  key: string
): Record<string, number | null> {
  if (!section) return {};
  const row = section.rows.find((r) => r.key === key);
  return row?.values ?? {};
}

function safeDivide(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (
    typeof numerator !== 'number' ||
    typeof denominator !== 'number' ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }
  return numerator / denominator;
}

function roundRatio(val: number | null, decimals = 2): number | null {
  if (val === null || !Number.isFinite(val)) return null;
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

export function buildFinancialRatioHistoryReport(
  statements: FinancialStatementsReport,
  periodType: StatementPeriodType = 'annual',
  valuationSnapshot?: {
    trailingPE?: number | null;
    forwardPE?: number | null;
    priceToBook?: number | null;
  }
): FinancialRatioHistoryReport {
  const bucket = periodType === 'annual' ? statements.annual : statements.quarterly;
  const income = bucket.income;
  const balance = bucket.balance;
  const cashflow = bucket.cashflow;

  // Union of periods across income, balance, and cashflow sorted latest-first
  const periodMap = new Map<string, FinancialStatementPeriod>();
  for (const sec of [income, balance, cashflow]) {
    for (const p of sec.periods) {
      if (!periodMap.has(p.id)) {
        periodMap.set(p.id, p);
      }
    }
  }
  const periods = Array.from(periodMap.values()).sort((a, b) =>
    b.endDate.localeCompare(a.endDate)
  );

  const revenue = getRowValueMap(income, 'totalRevenue');
  const grossProfit = getRowValueMap(income, 'grossProfit');
  const operatingIncome = getRowValueMap(income, 'operatingIncome');
  const netIncome = getRowValueMap(income, 'netIncome');

  const totalAssets = getRowValueMap(balance, 'totalAssets');
  const currentAssets = getRowValueMap(balance, 'totalCurrentAssets');
  const currentLiabilities = getRowValueMap(balance, 'totalCurrentLiabilities');
  const totalDebt = getRowValueMap(balance, 'totalDebt');
  const equity = getRowValueMap(balance, 'totalStockholderEquity');

  const freeCashFlow = getRowValueMap(cashflow, 'freeCashFlow');

  const computeSeries = (fn: (periodId: string) => number | null): Record<string, number | null> => {
    const out: Record<string, number | null> = {};
    for (const p of periods) {
      out[p.id] = fn(p.id);
    }
    return out;
  };

  const candidates: FinancialRatioRow[] = [
    {
      key: 'grossMargin',
      label: 'Brüt Kâr Marjı (%)',
      category: 'profitability',
      unit: 'percent',
      formula: '(Brüt Kâr / Toplam Hasılat) × 100',
      methodNote: 'Dönemsel gelir tablosundaki Brüt Kâr tutarının Toplam Hasılat içindeki payı.',
      values: computeSeries((id) => {
        const rev = revenue[id];
        if (typeof rev !== 'number' || rev <= 0) return null;
        const r = safeDivide(grossProfit[id], rev);
        return r === null ? null : roundRatio(r * 100, 1);
      }),
    },
    {
      key: 'operatingMargin',
      label: 'Faaliyet Kâr Marjı (EBIT %)',
      category: 'profitability',
      unit: 'percent',
      formula: '(Faaliyet Kârı / Toplam Hasılat) × 100',
      methodNote: 'Esas faaliyet kârının (EBIT) dönemsel net satış hasılatına oranı.',
      values: computeSeries((id) => {
        const rev = revenue[id];
        if (typeof rev !== 'number' || rev <= 0) return null;
        const r = safeDivide(operatingIncome[id], rev);
        return r === null ? null : roundRatio(r * 100, 1);
      }),
    },
    {
      key: 'netProfitMargin',
      label: 'Net Kâr Marjı (%)',
      category: 'profitability',
      unit: 'percent',
      formula: '(Net Dönem Kârı / Toplam Hasılat) × 100',
      methodNote: 'Dönem net kârının toplam hasılata bölünmesiyle elde edilir.',
      values: computeSeries((id) => {
        const rev = revenue[id];
        if (typeof rev !== 'number' || rev <= 0) return null;
        const r = safeDivide(netIncome[id], rev);
        return r === null ? null : roundRatio(r * 100, 1);
      }),
    },
    {
      key: 'roe',
      label: 'Özkaynak Kârlılığı (ROE %)',
      category: 'profitability',
      unit: 'percent',
      formula: '(Net Dönem Kârı / Dönem Sonu Özkaynaklar) × 100',
      methodNote:
        periodType === 'annual'
          ? 'Yıllık Net Kâr kaleminin dönem sonu Özkaynaklara oranı.'
          : 'Çeyreklik Net Kâr kaleminin dönem sonu Özkaynaklara yıllıklandırılmamış oranı.',
      values: computeSeries((id) => {
        const eq = equity[id];
        if (typeof eq !== 'number' || eq <= 0) return null;
        const r = safeDivide(netIncome[id], eq);
        return r === null ? null : roundRatio(r * 100, 1);
      }),
    },
    {
      key: 'roa',
      label: 'Aktif Kârlılığı (ROA %)',
      category: 'profitability',
      unit: 'percent',
      formula: '(Net Dönem Kârı / Toplam Varlıklar) × 100',
      methodNote: 'Net dönem kârının dönem sonu toplam aktif büyüklüğüne oranı.',
      values: computeSeries((id) => {
        const assets = totalAssets[id];
        if (typeof assets !== 'number' || assets <= 0) return null;
        const r = safeDivide(netIncome[id], assets);
        return r === null ? null : roundRatio(r * 100, 1);
      }),
    },
    {
      key: 'debtToEquity',
      label: 'Borç / Özkaynak',
      category: 'leverage',
      unit: 'multiple',
      formula: 'Toplam Finansal Borç / Özkaynaklar',
      methodNote: 'Kısa ve uzun vadeli finansal borç toplamının özkaynaklara oranı (×).',
      values: computeSeries((id) => {
        const eq = equity[id];
        if (typeof eq !== 'number' || eq <= 0) return null;
        return roundRatio(safeDivide(totalDebt[id], eq), 2);
      }),
    },
    {
      key: 'currentRatio',
      label: 'Cari Oran',
      category: 'liquidity',
      unit: 'multiple',
      formula: 'Dönen Varlıklar / Kısa Vadeli Yükümlülükler',
      methodNote: 'Kısa vadeli borçları dönen varlıklarla karşılama gücü (×).',
      values: computeSeries((id) => {
        const cl = currentLiabilities[id];
        if (typeof cl !== 'number' || cl <= 0) return null;
        return roundRatio(safeDivide(currentAssets[id], cl), 2);
      }),
    },
    {
      key: 'fcfMargin',
      label: 'Serbest Nakit Akışı Marjı (%)',
      category: 'cashflow',
      unit: 'percent',
      formula: '((İşletme Nakit Akışı − |CapEx|) / Hasılat) × 100',
      methodNote: 'İşletme nakit akışından yatırım harcamaları düşülerek hesaplanan FCF marjı.',
      values: computeSeries((id) => {
        const rev = revenue[id];
        if (typeof rev !== 'number' || rev <= 0) return null;
        const r = safeDivide(freeCashFlow[id], rev);
        return r === null ? null : roundRatio(r * 100, 1);
      }),
    },
  ];

  const rows = candidates.filter((row) =>
    Object.values(row.values).some((v) => v !== null)
  );

  const valuationMetrics: ValuationSnapshotMetric[] = [
    {
      key: 'trailingPE',
      label: 'Güncel F/K (TTM)',
      value:
        typeof valuationSnapshot?.trailingPE === 'number' && Number.isFinite(valuationSnapshot.trailingPE)
          ? roundRatio(valuationSnapshot.trailingPE, 2)
          : null,
      formula: 'Hisse Fiyatı / Son 12 Ay Hisse Başına Kâr',
      methodNote: 'Gerçekleşmiş son 4 çeyrek net kârı esas alır (kaynak: Yahoo Finance).',
    },
    {
      key: 'forwardPE',
      label: 'Beklenen F/K',
      value:
        typeof valuationSnapshot?.forwardPE === 'number' && Number.isFinite(valuationSnapshot.forwardPE)
          ? roundRatio(valuationSnapshot.forwardPE, 2)
          : null,
      formula: 'Hisse Fiyatı / Analist 12 Ay Kâr Tahmini',
      methodNote: 'Analist tahminleri mevcut olduğunda hesaplanan ileri dönük çarpan.',
    },
    {
      key: 'priceToBook',
      label: 'PD/DD',
      value:
        typeof valuationSnapshot?.priceToBook === 'number' && Number.isFinite(valuationSnapshot.priceToBook)
          ? roundRatio(valuationSnapshot.priceToBook, 2)
          : null,
      formula: 'Piyasa Değeri / Güncel Özkaynaklar',
      methodNote: 'Son açıklanan bilanço özkaynak toplamına göre güncel piyasa çarpanı.',
    },
  ];

  const hasAnyRatio = rows.length > 0 || valuationMetrics.some((m) => m.value !== null);

  return {
    symbol: statements.symbol,
    periodType,
    currency: statements.currency,
    periods,
    rows,
    valuationMetrics,
    hasAnyRatio,
    notice: !hasAnyRatio
      ? 'Bu hisse için dönemsel finansal oran hesaplamasına yetecek bilanço/gelir kalemi bulunamadı.'
      : null,
  };
}

export function formatRatioMetricValue(value: number | null, unit: FinancialRatioUnit): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (unit === 'percent') {
    return `${value < 0 ? '-' : ''}%${Math.abs(value).toFixed(1)}`;
  }
  if (unit === 'multiple') {
    return `${value.toFixed(2)}×`;
  }
  return value.toFixed(2);
}
