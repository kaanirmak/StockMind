import { calculateDCF, type DCFParams } from '@/lib/quant/models';

export interface ScenarioOverrides {
  fcfMultiplier?: number;
  fcfGrowthDeltaPct?: number;
  waccDeltaPct?: number;
  terminalGrowthDeltaPct?: number;
}

export interface DCFScenarioColumn {
  id: 'bear' | 'base' | 'bull';
  label: 'Olumsuz' | 'Baz' | 'İyimser';
  inputs: {
    freeCashFlow: number;
    fcfGrowthRate: number;
    terminalGrowthRate: number;
    discountRate: number;
    netDebt: number;
    sharesOutstanding: number;
    currentPrice: number;
  };
  outputs: {
    totalPresentValue: number;
    terminalValuePV: number;
    enterpriseValue: number;
    equityValue: number;
    fairValuePerShare: number;
    upsidePercent: number;
    verdict: string;
  };
}

export interface ScenarioComparisonMatrixRow {
  key: string;
  section: 'Girdi' | 'Sonuç';
  label: string;
  bearValue: string;
  baseValue: string;
  bullValue: string;
}

export interface DCFScenarioComparisonResult {
  currencySign: '$' | '₺';
  columns: [DCFScenarioColumn, DCFScenarioColumn, DCFScenarioColumn];
  rows: ScenarioComparisonMatrixRow[];
}

export const DEFAULT_BULL_OVERRIDES: Required<ScenarioOverrides> = {
  fcfMultiplier: 1.1,
  fcfGrowthDeltaPct: 4,
  waccDeltaPct: -1.5,
  terminalGrowthDeltaPct: 0.5,
};

export const DEFAULT_BEAR_OVERRIDES: Required<ScenarioOverrides> = {
  fcfMultiplier: 0.9,
  fcfGrowthDeltaPct: -5,
  waccDeltaPct: 2,
  terminalGrowthDeltaPct: -0.5,
};

function computeColumn(
  id: DCFScenarioColumn['id'],
  label: DCFScenarioColumn['label'],
  base: DCFParams,
  overrides: Required<ScenarioOverrides>
): DCFScenarioColumn {
  const fcf = Number((base.freeCashFlow * overrides.fcfMultiplier).toFixed(1));
  const fcfGrowthRate = Number((base.growthRate5Y + overrides.fcfGrowthDeltaPct).toFixed(1));
  const terminalGrowthRate = Number(
    Math.max(1, base.terminalGrowthRate + overrides.terminalGrowthDeltaPct).toFixed(1)
  );
  const rawWacc = base.wacc + overrides.waccDeltaPct;
  const discountRate = Number(Math.max(terminalGrowthRate + 1, rawWacc).toFixed(1));

  const params: DCFParams = {
    ...base,
    freeCashFlow: fcf,
    growthRate5Y: fcfGrowthRate,
    terminalGrowthRate,
    wacc: discountRate,
  };
  const dcf = calculateDCF(params);
  const upsidePercent =
    base.currentPrice > 0
      ? Number((((dcf.fairValuePerShare - base.currentPrice) / base.currentPrice) * 100).toFixed(1))
      : 0;

  return {
    id,
    label,
    inputs: {
      freeCashFlow: fcf,
      fcfGrowthRate,
      terminalGrowthRate,
      discountRate: dcf.assumptionValidation.effectiveWacc,
      netDebt: base.netDebt,
      sharesOutstanding: base.sharesOutstanding,
      currentPrice: base.currentPrice,
    },
    outputs: {
      totalPresentValue: dcf.sumPVScheduled,
      terminalValuePV: dcf.pvTerminalValue,
      enterpriseValue: dcf.enterpriseValue,
      equityValue: dcf.equityValue,
      fairValuePerShare: dcf.fairValuePerShare,
      upsidePercent,
      verdict: dcf.verdict,
    },
  };
}

export function buildDCFScenarioComparison(
  baseParams: DCFParams,
  customOverrides?: {
    bull?: ScenarioOverrides;
    bear?: ScenarioOverrides;
  }
): DCFScenarioComparisonResult {
  const bearOverrides: Required<ScenarioOverrides> = {
    ...DEFAULT_BEAR_OVERRIDES,
    ...customOverrides?.bear,
  };
  const baseOverrides: Required<ScenarioOverrides> = {
    fcfMultiplier: 1,
    fcfGrowthDeltaPct: 0,
    waccDeltaPct: 0,
    terminalGrowthDeltaPct: 0,
  };
  const bullOverrides: Required<ScenarioOverrides> = {
    ...DEFAULT_BULL_OVERRIDES,
    ...customOverrides?.bull,
  };

  const bear = computeColumn('bear', 'Olumsuz', baseParams, bearOverrides);
  const base = computeColumn('base', 'Baz', baseParams, baseOverrides);
  const bull = computeColumn('bull', 'İyimser', baseParams, bullOverrides);

  const currencySign: '$' | '₺' = baseParams.statementCurrency === 'USD' ? '$' : '₺';
  const fmtM = (n: number) => `${currencySign}${n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} M`;
  const fmtPrice = (n: number) => `${currencySign}${n.toFixed(2)}`;
  const fmtPct = (n: number) => `%${n.toFixed(1)}`;
  const fmtSignedPct = (n: number) => `${n >= 0 ? '+' : ''}%${n.toFixed(1)}`;

  const rows: ScenarioComparisonMatrixRow[] = [
    {
      key: 'fcf',
      section: 'Girdi',
      label: 'Başlangıç FCF',
      bearValue: fmtM(bear.inputs.freeCashFlow),
      baseValue: fmtM(base.inputs.freeCashFlow),
      bullValue: fmtM(bull.inputs.freeCashFlow),
    },
    {
      key: 'fcfGrowth',
      section: 'Girdi',
      label: 'Yıllık FCF Büyümesi',
      bearValue: fmtPct(bear.inputs.fcfGrowthRate),
      baseValue: fmtPct(base.inputs.fcfGrowthRate),
      bullValue: fmtPct(bull.inputs.fcfGrowthRate),
    },
    {
      key: 'wacc',
      section: 'Girdi',
      label: 'İskonto Oranı (WACC)',
      bearValue: fmtPct(bear.inputs.discountRate),
      baseValue: fmtPct(base.inputs.discountRate),
      bullValue: fmtPct(bull.inputs.discountRate),
    },
    {
      key: 'terminalGrowth',
      section: 'Girdi',
      label: 'Terminal Büyüme (g)',
      bearValue: fmtPct(bear.inputs.terminalGrowthRate),
      baseValue: fmtPct(base.inputs.terminalGrowthRate),
      bullValue: fmtPct(bull.inputs.terminalGrowthRate),
    },
    {
      key: 'ev',
      section: 'Sonuç',
      label: 'Firma Değeri (EV)',
      bearValue: fmtM(bear.outputs.enterpriseValue),
      baseValue: fmtM(base.outputs.enterpriseValue),
      bullValue: fmtM(bull.outputs.enterpriseValue),
    },
    {
      key: 'equityValue',
      section: 'Sonuç',
      label: 'Özsermaye Değeri',
      bearValue: fmtM(bear.outputs.equityValue),
      baseValue: fmtM(base.outputs.equityValue),
      bullValue: fmtM(bull.outputs.equityValue),
    },
    {
      key: 'fairValue',
      section: 'Sonuç',
      label: 'Hisse Adil Değeri',
      bearValue: fmtPrice(bear.outputs.fairValuePerShare),
      baseValue: fmtPrice(base.outputs.fairValuePerShare),
      bullValue: fmtPrice(bull.outputs.fairValuePerShare),
    },
    {
      key: 'upside',
      section: 'Sonuç',
      label: 'Cari Fiyata Göre Fark',
      bearValue: fmtSignedPct(bear.outputs.upsidePercent),
      baseValue: fmtSignedPct(base.outputs.upsidePercent),
      bullValue: fmtSignedPct(bull.outputs.upsidePercent),
    },
    {
      key: 'verdict',
      section: 'Sonuç',
      label: 'Değerleme Yorumu',
      bearValue: bear.outputs.verdict,
      baseValue: base.outputs.verdict,
      bullValue: bull.outputs.verdict,
    },
  ];

  return {
    currencySign,
    columns: [bear, base, bull],
    rows,
  };
}
