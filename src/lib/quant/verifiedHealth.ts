import type {
  FinancialStatementsReport,
  StatementKind,
  StatementPeriodType,
} from '@/lib/market/financialStatements';
import {
  evaluateAltmanZ,
  evaluateDuPont,
  evaluatePiotroski,
  type AltmanResult,
  type DuPontResult,
  type PiotroskiItem,
  type PiotroskiResult,
} from '@/lib/quant/models';

export interface HealthUsedItem {
  statement: StatementKind | 'market';
  key: string;
  label: string;
  periodLabel: string;
  value: number;
  formattedValue: string;
}

export interface VerifiedPiotroskiItem extends PiotroskiItem {
  status: 'passed' | 'failed' | 'missing';
  periodLabel: string;
  usedKeys: string[];
  missingInputs: string[];
}

export interface VerifiedPiotroskiOutput {
  isSourced: boolean;
  isComplete: boolean;
  evaluatedCount: number;
  maxScore: number;
  score: number;
  verdict: PiotroskiResult['verdict'] | 'Eksik Veri';
  color: string;
  sourceName: string;
  periodType: StatementPeriodType;
  periodsUsed: string[];
  usedItems: HealthUsedItem[];
  missingInputs: string[];
  items: VerifiedPiotroskiItem[];
}

export interface VerifiedAltmanComponent {
  label: string;
  factor: string;
  value: number | null;
  weighted: number | null;
  missingInput: string | null;
}

export interface VerifiedAltmanOutput {
  isSourced: boolean;
  isComplete: boolean;
  zScore: number | null;
  zone: AltmanResult['zone'] | 'Eksik Veri';
  color: string;
  interpretation: string;
  sourceName: string;
  periodType: StatementPeriodType;
  periodsUsed: string[];
  usedItems: HealthUsedItem[];
  missingInputs: string[];
  components: VerifiedAltmanComponent[];
}

export interface VerifiedDuPontOutput {
  isSourced: boolean;
  isComplete: boolean;
  roe: number | null;
  netMargin: number | null;
  assetTurnover: number | null;
  financialLeverage: number | null;
  verdict: string;
  sourceName: string;
  periodType: StatementPeriodType;
  periodsUsed: string[];
  usedItems: HealthUsedItem[];
  missingInputs: string[];
}

export interface VerifiedHealthReport {
  symbol: string;
  periodType: StatementPeriodType;
  currency: string;
  isSourced: boolean;
  sourceName: string;
  periodsUsed: string[];
  piotroski: VerifiedPiotroskiOutput;
  altman: VerifiedAltmanOutput;
  dupont: VerifiedDuPontOutput;
}

function formatBillions(value: number, currency: string): string {
  const sym = currency === 'USD' ? '$' : '₺';
  if (Math.abs(value) >= 1e9) {
    return `${sym}${(value / 1e9).toFixed(2)} Mr`;
  }
  if (Math.abs(value) >= 1e6) {
    return `${sym}${(value / 1e6).toFixed(1)} Mn`;
  }
  return `${sym}${value.toFixed(0)}`;
}

function pickRowValue(
  report: FinancialStatementsReport,
  periodType: StatementPeriodType,
  kind: StatementKind,
  key: string,
  periodIndex: number
): {
  value: number | null;
  label: string;
  periodLabel: string;
} {
  const section = report[periodType]?.[kind];
  if (!section) {
    return { value: null, label: key, periodLabel: '' };
  }
  const period = section.periods[periodIndex];
  const row = section.rows.find((r) => r.key === key);
  const label = row?.label || key;
  if (!period) {
    return { value: null, label, periodLabel: '' };
  }
  const periodLabel = `${period.label} (${period.endDate})`;
  const raw = row?.values?.[period.id];
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  return { value, label, periodLabel };
}

function addUsedItem(
  list: HealthUsedItem[],
  item: HealthUsedItem
): void {
  const exists = list.some(
    (entry) =>
      entry.statement === item.statement &&
      entry.key === item.key &&
      entry.periodLabel === item.periodLabel
  );
  if (!exists) {
    list.push(item);
  }
}

function buildFallbackReport(params: {
  symbol: string;
  periodType: StatementPeriodType;
  livePrice?: number;
}): VerifiedHealthReport {
  const p = evaluatePiotroski(params.symbol, params.livePrice);
  const a = evaluateAltmanZ(params.symbol, params.livePrice);
  const d = evaluateDuPont(params.symbol, params.livePrice);

  const missingBase = [
    'Doğrulanmış Gelir Tablosu',
    'Doğrulanmış Bilanço',
    'Doğrulanmış Nakit Akış Tablosu',
  ];

  return {
    symbol: params.symbol,
    periodType: params.periodType,
    currency: 'TRY',
    isSourced: false,
    sourceName: 'Doğrulanmış finansal rapor yok (örnek profil kullanıldı)',
    periodsUsed: [],
    piotroski: {
      isSourced: false,
      isComplete: false,
      evaluatedCount: 0,
      maxScore: p.maxScore,
      score: p.score,
      verdict: p.verdict,
      color: p.color,
      sourceName: 'Örnek Model Profili',
      periodType: params.periodType,
      periodsUsed: [],
      usedItems: [],
      missingInputs: missingBase,
      items: p.items.map((item) => ({
        ...item,
        status: item.passed ? 'passed' : 'failed',
        periodLabel: 'Örnek Profil',
        usedKeys: [],
        missingInputs: missingBase,
      })),
    },
    altman: {
      isSourced: false,
      isComplete: false,
      zScore: a.zScore,
      zone: a.zone,
      color: a.color,
      interpretation: a.interpretation,
      sourceName: 'Örnek Model Profili',
      periodType: params.periodType,
      periodsUsed: [],
      usedItems: [],
      missingInputs: missingBase,
      components: a.components.map((c) => ({
        label: c.label,
        factor: c.factor,
        value: c.value,
        weighted: c.weighted,
        missingInput: 'Doğrulanmış bilanço/gelir kalemi bekleniyor',
      })),
    },
    dupont: {
      isSourced: false,
      isComplete: false,
      roe: d.roe,
      netMargin: d.netMargin,
      assetTurnover: d.assetTurnover,
      financialLeverage: d.financialLeverage,
      verdict: d.verdict,
      sourceName: 'Örnek Model Profili',
      periodType: params.periodType,
      periodsUsed: [],
      usedItems: [],
      missingInputs: missingBase,
    },
  };
}

export function evaluateHealthFromVerifiedFinancials(params: {
  symbol: string;
  report?: FinancialStatementsReport | null;
  periodType?: StatementPeriodType;
  marketCap?: number | null;
  livePrice?: number;
}): VerifiedHealthReport {
  const symbol = params.symbol.trim().toUpperCase();
  const periodType: StatementPeriodType = params.periodType ?? 'annual';
  const report = params.report ?? null;

  if (!report || (report.status !== 'ok' && report.status !== 'partial')) {
    return buildFallbackReport({ symbol, periodType, livePrice: params.livePrice });
  }

  const currency = report.currency || 'TRY';
  const sourceName = report.sourceName || 'Yahoo Finance / Finansal Tablolar';
  const sectionPeriods =
    report[periodType]?.income?.periods?.length > 0
      ? report[periodType].income.periods
      : report[periodType]?.balance?.periods ?? [];

  if (sectionPeriods.length === 0) {
    return buildFallbackReport({ symbol, periodType, livePrice: params.livePrice });
  }

  const periodsUsed = sectionPeriods
    .slice(0, 2)
    .map((p) => `${p.label} (${p.endDate})`);

  const getVal = (kind: StatementKind, key: string, idx: number) => {
    const res = pickRowValue(report, periodType, kind, key, idx);
    return res;
  };

  // Fetch core verified fields for current (0) and prior (1)
  const netInc0 = getVal('income', 'netIncome', 0);
  const netInc1 = getVal('income', 'netIncome', 1);
  const rev0 = getVal('income', 'totalRevenue', 0);
  const rev1 = getVal('income', 'totalRevenue', 1);
  const gp0 = getVal('income', 'grossProfit', 0);
  const gp1 = getVal('income', 'grossProfit', 1);
  const ebit0 = getVal('income', 'operatingIncome', 0);
  const retained0 = getVal('balance', 'retainedEarnings', 0);

  const assets0 = getVal('balance', 'totalAssets', 0);
  const assets1 = getVal('balance', 'totalAssets', 1);
  const curAssets0 = getVal('balance', 'totalCurrentAssets', 0);
  const curAssets1 = getVal('balance', 'totalCurrentAssets', 1);
  const curLiab0 = getVal('balance', 'totalCurrentLiabilities', 0);
  const curLiab1 = getVal('balance', 'totalCurrentLiabilities', 1);
  const totalDebt0 = getVal('balance', 'totalDebt', 0);
  const totalDebt1 = getVal('balance', 'totalDebt', 1);
  const totalLiab0 = getVal('balance', 'totalLiab', 0);
  const equity0 = getVal('balance', 'totalStockholderEquity', 0);

  const cfo0 = getVal('cashflow', 'operatingCashFlow', 0);

  // ---------------- 1. PIOTROSKI F-SCORE ----------------
  const pioUsed: HealthUsedItem[] = [];
  const pioMissingSet = new Set<string>();
  const pioItems: VerifiedPiotroskiItem[] = [];

  const trackUsed = (
    target: HealthUsedItem[],
    statement: StatementKind,
    key: string,
    field: { value: number | null; label: string; periodLabel: string }
  ) => {
    if (field.value !== null && field.periodLabel) {
      addUsedItem(target, {
        statement,
        key,
        label: field.label,
        periodLabel: field.periodLabel,
        value: field.value,
        formattedValue: formatBillions(field.value, currency),
      });
    }
  };

  // F1: Net Income > 0
  if (netInc0.value !== null) {
    trackUsed(pioUsed, 'income', 'netIncome', netInc0);
    pioItems.push({
      id: 'f1',
      category: 'Kârlılık',
      title: 'Pozitif Net Kâr (Net Kâr > 0)',
      description: 'Cari dönem net kârı pozitif bölgede.',
      passed: netInc0.value > 0,
      status: netInc0.value > 0 ? 'passed' : 'failed',
      value: `Net Kâr: ${formatBillions(netInc0.value, currency)}`,
      periodLabel: netInc0.periodLabel,
      usedKeys: ['netIncome'],
      missingInputs: [],
    });
  } else {
    pioMissingSet.add('Net Kâr (cari dönem)');
    pioItems.push({
      id: 'f1',
      category: 'Kârlılık',
      title: 'Pozitif Net Kâr (Net Kâr > 0)',
      description: 'Cari dönem net kâr verisi bulunamadı.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: netInc0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: ['Net Kâr'],
    });
  }

  // F2: Operating Cash Flow > 0
  if (cfo0.value !== null) {
    trackUsed(pioUsed, 'cashflow', 'operatingCashFlow', cfo0);
    pioItems.push({
      id: 'f2',
      category: 'Kârlılık',
      title: 'Pozitif Faaliyet Nakit Akışı (CFO > 0)',
      description: 'Operasyonlardan elde edilen nakit akışı pozitif.',
      passed: cfo0.value > 0,
      status: cfo0.value > 0 ? 'passed' : 'failed',
      value: `CFO: ${formatBillions(cfo0.value, currency)}`,
      periodLabel: cfo0.periodLabel,
      usedKeys: ['operatingCashFlow'],
      missingInputs: [],
    });
  } else {
    pioMissingSet.add('İşletme Nakit Akışı (CFO)');
    pioItems.push({
      id: 'f2',
      category: 'Kârlılık',
      title: 'Pozitif Faaliyet Nakit Akışı (CFO > 0)',
      description: 'Cari dönem işletme nakit akışı verisi eksik.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: cfo0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: ['İşletme Nakit Akışı (CFO)'],
    });
  }

  // F3: ROA Growth (Net Income / Total Assets)
  if (
    netInc0.value !== null &&
    assets0.value !== null &&
    assets0.value > 0 &&
    netInc1.value !== null &&
    assets1.value !== null &&
    assets1.value > 0
  ) {
    trackUsed(pioUsed, 'income', 'netIncome', netInc0);
    trackUsed(pioUsed, 'income', 'netIncome', netInc1);
    trackUsed(pioUsed, 'balance', 'totalAssets', assets0);
    trackUsed(pioUsed, 'balance', 'totalAssets', assets1);
    const roa0 = (netInc0.value / assets0.value) * 100;
    const roa1 = (netInc1.value / assets1.value) * 100;
    const delta = roa0 - roa1;
    pioItems.push({
      id: 'f3',
      category: 'Kârlılık',
      title: 'ROA Büyümesi (ΔROA > 0)',
      description: 'Aktif kârlılığı önceki döneme kıyasla yükseldi.',
      passed: delta > 0,
      status: delta > 0 ? 'passed' : 'failed',
      value: `ΔROA: %${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`,
      periodLabel: `${netInc0.periodLabel} vs ${netInc1.periodLabel}`,
      usedKeys: ['netIncome', 'totalAssets'],
      missingInputs: [],
    });
  } else {
    const m = 'Önceki/Cari dönem Net Kâr veya Toplam Varlıklar (ΔROA)';
    pioMissingSet.add(m);
    pioItems.push({
      id: 'f3',
      category: 'Kârlılık',
      title: 'ROA Büyümesi (ΔROA > 0)',
      description: 'Dönemsel ROA karşılaştırması için önceki dönem verisi eksik.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: assets0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: [m],
    });
  }

  // F4: Earnings Quality (CFO > Net Income)
  if (cfo0.value !== null && netInc0.value !== null) {
    trackUsed(pioUsed, 'cashflow', 'operatingCashFlow', cfo0);
    trackUsed(pioUsed, 'income', 'netIncome', netInc0);
    const passed = cfo0.value > netInc0.value;
    pioItems.push({
      id: 'f4',
      category: 'Kârlılık',
      title: 'Kazanç Kalitesi (CFO > Net Kâr)',
      description: 'Operasyonel nakdin net kârı aşması tahakkuk riskini azaltır.',
      passed,
      status: passed ? 'passed' : 'failed',
      value: `CFO ${passed ? '>' : '≤'} Net Kâr`,
      periodLabel: cfo0.periodLabel,
      usedKeys: ['operatingCashFlow', 'netIncome'],
      missingInputs: [],
    });
  } else {
    const m = 'CFO veya Net Kâr (Kazanç Kalitesi)';
    pioMissingSet.add(m);
    pioItems.push({
      id: 'f4',
      category: 'Kârlılık',
      title: 'Kazanç Kalitesi (CFO > Net Kâr)',
      description: 'Nakit akışı veya net kâr verisi eksik.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: netInc0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: [m],
    });
  }

  // F5: Debt / Total Assets Decreasing
  if (
    totalDebt0.value !== null &&
    assets0.value !== null &&
    assets0.value > 0 &&
    totalDebt1.value !== null &&
    assets1.value !== null &&
    assets1.value > 0
  ) {
    trackUsed(pioUsed, 'balance', 'totalDebt', totalDebt0);
    trackUsed(pioUsed, 'balance', 'totalDebt', totalDebt1);
    trackUsed(pioUsed, 'balance', 'totalAssets', assets0);
    trackUsed(pioUsed, 'balance', 'totalAssets', assets1);
    const lev0 = totalDebt0.value / assets0.value;
    const lev1 = totalDebt1.value / assets1.value;
    const passed = lev0 < lev1;
    pioItems.push({
      id: 'f5',
      category: 'Kaldıraç & Likidite',
      title: 'Borç / Varlık Oranında Azalma',
      description: 'Toplam borcun toplam varlıklara oranı önceki döneme göre geriledi.',
      passed,
      status: passed ? 'passed' : 'failed',
      value: `%${(lev0 * 100).toFixed(1)} (önceki %${(lev1 * 100).toFixed(1)})`,
      periodLabel: `${totalDebt0.periodLabel} vs ${totalDebt1.periodLabel}`,
      usedKeys: ['totalDebt', 'totalAssets'],
      missingInputs: [],
    });
  } else {
    const m = 'Önceki/Cari dönem Toplam Borç veya Varlıklar';
    pioMissingSet.add(m);
    pioItems.push({
      id: 'f5',
      category: 'Kaldıraç & Likidite',
      title: 'Borç / Varlık Oranında Azalma',
      description: 'Borç değişimini ölçmek için önceki dönem verisi eksik.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: assets0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: [m],
    });
  }

  // F6: Current Ratio Improvement
  if (
    curAssets0.value !== null &&
    curLiab0.value !== null &&
    curLiab0.value > 0 &&
    curAssets1.value !== null &&
    curLiab1.value !== null &&
    curLiab1.value > 0
  ) {
    trackUsed(pioUsed, 'balance', 'totalCurrentAssets', curAssets0);
    trackUsed(pioUsed, 'balance', 'totalCurrentAssets', curAssets1);
    trackUsed(pioUsed, 'balance', 'totalCurrentLiabilities', curLiab0);
    trackUsed(pioUsed, 'balance', 'totalCurrentLiabilities', curLiab1);
    const cr0 = curAssets0.value / curLiab0.value;
    const cr1 = curAssets1.value / curLiab1.value;
    const passed = cr0 > cr1;
    pioItems.push({
      id: 'f6',
      category: 'Kaldıraç & Likidite',
      title: 'Cari Oranda Artış',
      description: 'Dönen varlık / kısa vadeli yükümlülük oranı yükseldi.',
      passed,
      status: passed ? 'passed' : 'failed',
      value: `${cr0.toFixed(2)}x (önceki ${cr1.toFixed(2)}x)`,
      periodLabel: `${curAssets0.periodLabel} vs ${curAssets1.periodLabel}`,
      usedKeys: ['totalCurrentAssets', 'totalCurrentLiabilities'],
      missingInputs: [],
    });
  } else {
    const m = 'Dönen Varlıklar / Kısa Vadeli Yükümlülükler (Cari Oran)';
    pioMissingSet.add(m);
    pioItems.push({
      id: 'f6',
      category: 'Kaldıraç & Likidite',
      title: 'Cari Oranda Artış',
      description: 'Dönen varlık veya kısa vadeli borç kalemi eksik.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: assets0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: [m],
    });
  }

  // F7: No Dilution (Share issuance / count delta) - Not present in statement rows -> mark missing transparently
  const dilutionMissing = 'Dönemsel Pay Adedi / Yeni Hisse İhracı';
  pioMissingSet.add(dilutionMissing);
  pioItems.push({
    id: 'f7',
    category: 'Kaldıraç & Likidite',
    title: 'Sermaye Sulandırması Yok',
    description: 'Finansal tablo özetinde dönemsel pay adedi değişimi sunulmadığı için doğrulanamadı.',
    passed: false,
    status: 'missing',
    value: 'Eksik Girdi',
    periodLabel: assets0.periodLabel || 'Yok',
    usedKeys: [],
    missingInputs: [dilutionMissing],
  });

  // F8: Gross Margin Growth
  if (
    gp0.value !== null &&
    rev0.value !== null &&
    rev0.value > 0 &&
    gp1.value !== null &&
    rev1.value !== null &&
    rev1.value > 0
  ) {
    trackUsed(pioUsed, 'income', 'grossProfit', gp0);
    trackUsed(pioUsed, 'income', 'grossProfit', gp1);
    trackUsed(pioUsed, 'income', 'totalRevenue', rev0);
    trackUsed(pioUsed, 'income', 'totalRevenue', rev1);
    const gm0 = (gp0.value / rev0.value) * 100;
    const gm1 = (gp1.value / rev1.value) * 100;
    const delta = gm0 - gm1;
    pioItems.push({
      id: 'f8',
      category: 'Operasyonel Verimlilik',
      title: 'Brüt Kâr Marjında Artış',
      description: 'Brüt marj önceki döneme göre iyileşti.',
      passed: delta > 0,
      status: delta > 0 ? 'passed' : 'failed',
      value: `%${gm0.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp)`,
      periodLabel: `${gp0.periodLabel} vs ${gp1.periodLabel}`,
      usedKeys: ['grossProfit', 'totalRevenue'],
      missingInputs: [],
    });
  } else {
    const m = 'Önceki/Cari dönem Brüt Kâr veya Hasılat';
    pioMissingSet.add(m);
    pioItems.push({
      id: 'f8',
      category: 'Operasyonel Verimlilik',
      title: 'Brüt Kâr Marjında Artış',
      description: 'Brüt kâr veya hasılat verisi eksik.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: rev0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: [m],
    });
  }

  // F9: Asset Turnover Growth
  if (
    rev0.value !== null &&
    assets0.value !== null &&
    assets0.value > 0 &&
    rev1.value !== null &&
    assets1.value !== null &&
    assets1.value > 0
  ) {
    trackUsed(pioUsed, 'income', 'totalRevenue', rev0);
    trackUsed(pioUsed, 'income', 'totalRevenue', rev1);
    trackUsed(pioUsed, 'balance', 'totalAssets', assets0);
    trackUsed(pioUsed, 'balance', 'totalAssets', assets1);
    const at0 = rev0.value / assets0.value;
    const at1 = rev1.value / assets1.value;
    const passed = at0 > at1;
    pioItems.push({
      id: 'f9',
      category: 'Operasyonel Verimlilik',
      title: 'Aktif Devir Hızında Artış',
      description: 'Varlık başına üretilen ciro yükseldi.',
      passed,
      status: passed ? 'passed' : 'failed',
      value: `${at0.toFixed(2)}x (önceki ${at1.toFixed(2)}x)`,
      periodLabel: `${rev0.periodLabel} vs ${rev1.periodLabel}`,
      usedKeys: ['totalRevenue', 'totalAssets'],
      missingInputs: [],
    });
  } else {
    const m = 'Önceki/Cari dönem Hasılat veya Toplam Varlıklar (Aktif Devir Hızı)';
    pioMissingSet.add(m);
    pioItems.push({
      id: 'f9',
      category: 'Operasyonel Verimlilik',
      title: 'Aktif Devir Hızında Artış',
      description: 'Aktif devir hızı kıyaslaması için veri eksik.',
      passed: false,
      status: 'missing',
      value: 'Eksik Veri',
      periodLabel: rev0.periodLabel || 'Yok',
      usedKeys: [],
      missingInputs: [m],
    });
  }

  const evaluatedCount = pioItems.filter((i) => i.status !== 'missing').length;
  const pioScore = pioItems.filter((i) => i.status === 'passed').length;
  const pioComplete = pioMissingSet.size === 0;
  let pioVerdict: VerifiedPiotroskiOutput['verdict'] = 'Eksik Veri';
  let pioColor = '#94a3b8';
  if (evaluatedCount > 0) {
    if (pioScore >= 7) {
      pioVerdict = 'Çok Güçlü';
      pioColor = '#10b981';
    } else if (pioScore >= 4) {
      pioVerdict = 'Dengeli';
      pioColor = '#f59e0b';
    } else {
      pioVerdict = 'Zayıf / Riskli';
      pioColor = '#f43f5e';
    }
  }

  // ---------------- 2. ALTMAN Z-SCORE ----------------
  const altUsed: HealthUsedItem[] = [];
  const altMissing: string[] = [];
  const altComponents: VerifiedAltmanComponent[] = [];

  if (
    curAssets0.value !== null &&
    curLiab0.value !== null &&
    assets0.value !== null &&
    assets0.value > 0
  ) {
    trackUsed(altUsed, 'balance', 'totalCurrentAssets', curAssets0);
    trackUsed(altUsed, 'balance', 'totalCurrentLiabilities', curLiab0);
    trackUsed(altUsed, 'balance', 'totalAssets', assets0);
    const x1 = (curAssets0.value - curLiab0.value) / assets0.value;
    altComponents.push({
      label: 'Çalışma Sermayesi / Aktifler',
      factor: '1.2 × X1',
      value: Number(x1.toFixed(3)),
      weighted: Number((1.2 * x1).toFixed(2)),
      missingInput: null,
    });
  } else {
    const m = 'Dönen Varlıklar / Kısa Vadeli Yükümlülükler / Toplam Varlıklar (X1)';
    altMissing.push(m);
    altComponents.push({
      label: 'Çalışma Sermayesi / Aktifler',
      factor: '1.2 × X1',
      value: null,
      weighted: null,
      missingInput: m,
    });
  }

  if (retained0.value !== null && assets0.value !== null && assets0.value > 0) {
    trackUsed(altUsed, 'balance', 'retainedEarnings', retained0);
    trackUsed(altUsed, 'balance', 'totalAssets', assets0);
    const x2 = retained0.value / assets0.value;
    altComponents.push({
      label: 'Geçmiş Yıl Kârları / Aktifler',
      factor: '1.4 × X2',
      value: Number(x2.toFixed(3)),
      weighted: Number((1.4 * x2).toFixed(2)),
      missingInput: null,
    });
  } else {
    const m = 'Geçmiş Yıl Kârları / Retained Earnings (X2)';
    altMissing.push(m);
    altComponents.push({
      label: 'Geçmiş Yıl Kârları / Aktifler',
      factor: '1.4 × X2',
      value: null,
      weighted: null,
      missingInput: m,
    });
  }

  if (ebit0.value !== null && assets0.value !== null && assets0.value > 0) {
    trackUsed(altUsed, 'income', 'operatingIncome', ebit0);
    trackUsed(altUsed, 'balance', 'totalAssets', assets0);
    const x3 = ebit0.value / assets0.value;
    altComponents.push({
      label: 'FVÖK (EBIT) / Aktifler',
      factor: '3.3 × X3',
      value: Number(x3.toFixed(3)),
      weighted: Number((3.3 * x3).toFixed(2)),
      missingInput: null,
    });
  } else {
    const m = 'Esas Faaliyet Kârı / EBIT (X3)';
    altMissing.push(m);
    altComponents.push({
      label: 'FVÖK (EBIT) / Aktifler',
      factor: '3.3 × X3',
      value: null,
      weighted: null,
      missingInput: m,
    });
  }

  if (
    typeof params.marketCap === 'number' &&
    Number.isFinite(params.marketCap) &&
    params.marketCap > 0 &&
    totalLiab0.value !== null &&
    totalLiab0.value > 0
  ) {
    addUsedItem(altUsed, {
      statement: 'market',
      key: 'marketCap',
      label: 'Piyasa Değeri',
      periodLabel: 'Güncel Piyasa',
      value: params.marketCap,
      formattedValue: formatBillions(params.marketCap, currency),
    });
    trackUsed(altUsed, 'balance', 'totalLiab', totalLiab0);
    const x4 = params.marketCap / totalLiab0.value;
    altComponents.push({
      label: 'Piyasa Değeri / Yükümlülükler',
      factor: '0.6 × X4',
      value: Number(x4.toFixed(3)),
      weighted: Number((0.6 * x4).toFixed(2)),
      missingInput: null,
    });
  } else {
    const m = 'Piyasa Değeri veya Toplam Yükümlülükler (X4)';
    altMissing.push(m);
    altComponents.push({
      label: 'Piyasa Değeri / Yükümlülükler',
      factor: '0.6 × X4',
      value: null,
      weighted: null,
      missingInput: m,
    });
  }

  if (rev0.value !== null && assets0.value !== null && assets0.value > 0) {
    trackUsed(altUsed, 'income', 'totalRevenue', rev0);
    trackUsed(altUsed, 'balance', 'totalAssets', assets0);
    const x5 = rev0.value / assets0.value;
    altComponents.push({
      label: 'Ciro / Toplam Aktifler',
      factor: '1.0 × X5',
      value: Number(x5.toFixed(3)),
      weighted: Number((1.0 * x5).toFixed(2)),
      missingInput: null,
    });
  } else {
    const m = 'Hasılat / Toplam Varlıklar (X5)';
    altMissing.push(m);
    altComponents.push({
      label: 'Ciro / Toplam Aktifler',
      factor: '1.0 × X5',
      value: null,
      weighted: null,
      missingInput: m,
    });
  }

  const altComplete = altMissing.length === 0;
  const availableWeighted = altComponents
    .map((c) => c.weighted)
    .filter((w): w is number => w !== null);
  const zScore =
    availableWeighted.length >= 3
      ? Number(availableWeighted.reduce((sum, w) => sum + w, 0).toFixed(2))
      : null;

  let altZone: VerifiedAltmanOutput['zone'] = 'Eksik Veri';
  let altColor = '#94a3b8';
  let altInterp =
    'Altman Z-Score bileşenlerinin tümü doğrulanmış finansallarda bulunmadığı için eksik girdiler listelendi.';
  if (zScore !== null) {
    if (zScore > 2.99) {
      altZone = 'Güvenli Bölge (Safe)';
      altColor = '#10b981';
      altInterp = altComplete
        ? 'Doğrulanmış bilanço kalemlerine göre şirket güvenli bölgede.'
        : 'Mevcut bileşenlerle güvenli bölgede; eksik kalemler aşağıda belirtilmiştir.';
    } else if (zScore >= 1.81) {
      altZone = 'Gri Bölge (Grey)';
      altColor = '#f59e0b';
      altInterp = altComplete
        ? 'Doğrulanmış verilere göre orta seviye risk (gri bölge).'
        : 'Mevcut bileşenlerle gri bölgede; eksik kalemler aşağıda belirtilmiştir.';
    } else {
      altZone = 'Sıkıntı Bölgesi (Distress)';
      altColor = '#f43f5e';
      altInterp = altComplete
        ? 'Doğrulanmış verilere göre likidite ve borç çevirme riski yüksek.'
        : 'Mevcut bileşenlerle sıkıntı bölgesinde; eksik kalemler aşağıda belirtilmiştir.';
    }
  }

  // ---------------- 3. DUPONT ROE ----------------
  const dupUsed: HealthUsedItem[] = [];
  const dupMissing: string[] = [];

  const netMargin =
    netInc0.value !== null && rev0.value !== null && rev0.value > 0
      ? Number(((netInc0.value / rev0.value) * 100).toFixed(1))
      : null;
  if (netMargin !== null) {
    trackUsed(dupUsed, 'income', 'netIncome', netInc0);
    trackUsed(dupUsed, 'income', 'totalRevenue', rev0);
  } else {
    dupMissing.push('Net Kâr veya Hasılat (Net Kâr Marjı)');
  }

  const assetTurnover =
    rev0.value !== null && assets0.value !== null && assets0.value > 0
      ? Number((rev0.value / assets0.value).toFixed(2))
      : null;
  if (assetTurnover !== null) {
    trackUsed(dupUsed, 'income', 'totalRevenue', rev0);
    trackUsed(dupUsed, 'balance', 'totalAssets', assets0);
  } else {
    dupMissing.push('Hasılat veya Toplam Varlıklar (Aktif Devir Hızı)');
  }

  const financialLeverage =
    assets0.value !== null && equity0.value !== null && equity0.value > 0
      ? Number((assets0.value / equity0.value).toFixed(2))
      : null;
  if (financialLeverage !== null) {
    trackUsed(dupUsed, 'balance', 'totalAssets', assets0);
    trackUsed(dupUsed, 'balance', 'totalStockholderEquity', equity0);
  } else {
    dupMissing.push('Toplam Varlıklar veya Özkaynaklar (Finansal Kaldıraç)');
  }

  const dupRoe =
    netMargin !== null && assetTurnover !== null && financialLeverage !== null
      ? Number(((netMargin / 100) * assetTurnover * financialLeverage * 100).toFixed(1))
      : null;

  let dupVerdict = 'Eksik finansal kalemler nedeniyle 3 bileşenli ROE tamamlanamadı.';
  if (dupRoe !== null && financialLeverage !== null && netMargin !== null && assetTurnover !== null) {
    if (financialLeverage > 3.2) {
      dupVerdict = 'ROE yüksek görünse de ana sürücü borç kaldıracı; temkinli değerlendirilmeli.';
    } else if (netMargin > 15 && assetTurnover > 0.8) {
      dupVerdict = 'Doğrulanmış verilere göre yüksek marj ve güçlü aktif devir hızı dengesi.';
    } else {
      dupVerdict = 'Doğrulanmış kalemlere göre kârlılık operasyonel marjlarla destekleniyor.';
    }
  }

  return {
    symbol,
    periodType,
    currency,
    isSourced: true,
    sourceName,
    periodsUsed,
    piotroski: {
      isSourced: true,
      isComplete: pioComplete,
      evaluatedCount,
      maxScore: 9,
      score: pioScore,
      verdict: pioVerdict,
      color: pioColor,
      sourceName,
      periodType,
      periodsUsed,
      usedItems: pioUsed,
      missingInputs: Array.from(pioMissingSet),
      items: pioItems,
    },
    altman: {
      isSourced: true,
      isComplete: altComplete,
      zScore,
      zone: altZone,
      color: altColor,
      interpretation: altInterp,
      sourceName,
      periodType,
      periodsUsed: periodsUsed.slice(0, 1),
      usedItems: altUsed,
      missingInputs: altMissing,
      components: altComponents,
    },
    dupont: {
      isSourced: true,
      isComplete: dupMissing.length === 0,
      roe: dupRoe,
      netMargin,
      assetTurnover,
      financialLeverage,
      verdict: dupVerdict,
      sourceName,
      periodType,
      periodsUsed: periodsUsed.slice(0, 1),
      usedItems: dupUsed,
      missingInputs: dupMissing,
    },
  };
}

