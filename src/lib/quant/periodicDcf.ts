import type {
  FinancialStatementsReport,
  StatementPeriodType,
} from '@/lib/market/financialStatements';

export interface PeriodicDcfInputSnapshot {
  symbol: string;
  periodType: StatementPeriodType;
  periodId: string | null;
  periodLabel: string;
  currency: 'TRY' | 'USD';
  freeCashFlowMillions: number | null;
  netDebtMillions: number | null;
  sharesOutstandingMillions: number | null;
  fcfSourceLabel: string;
  netDebtSourceLabel: string;
  sharesSourceLabel: string;
  availablePeriods: Array<{ id: string; label: string; endDate: string }>;
  missingFields: string[];
  isSourced: boolean;
}

function findRowValue(
  rows: ReadonlyArray<{ key: string; values: Record<string, number | null> }>,
  key: string,
  periodId: string | null
): number | null {
  if (!periodId) return null;
  const row = rows.find((r) => r.key === key);
  if (!row) return null;
  const val = row.values[periodId];
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

export function extractPeriodicDcfInputs(params: {
  symbol: string;
  report?: FinancialStatementsReport | null;
  periodType?: StatementPeriodType;
  periodId?: string | null;
  fallbackCurrency?: 'TRY' | 'USD';
  quoteSharesMillions?: number | null;
  fallbackSharesLabel?: string;
}): PeriodicDcfInputSnapshot {
  const symbol = params.symbol.trim().toUpperCase();
  const periodType: StatementPeriodType = params.periodType ?? 'annual';
  const report = params.report ?? null;
  const fallbackCurrency = params.fallbackCurrency ?? 'TRY';

  if (!report || (report.status !== 'ok' && report.status !== 'partial')) {
    return {
      symbol,
      periodType,
      periodId: null,
      periodLabel: 'Örnek Model Profili',
      currency: fallbackCurrency,
      freeCashFlowMillions: null,
      netDebtMillions: null,
      sharesOutstandingMillions: params.quoteSharesMillions ?? null,
      fcfSourceLabel: 'Örnek Model Profili (finansal tablo alınamadı)',
      netDebtSourceLabel: 'Örnek Model Profili (bilanço alınamadı)',
      sharesSourceLabel: params.fallbackSharesLabel || 'Örnek Model Profili',
      availablePeriods: [],
      missingFields: ['Serbest Nakit Akışı (FCF)', 'Net Borç'],
      isSourced: false,
    };
  }

  const cashflowSection = report[periodType].cashflow;
  const balanceSection = report[periodType].balance;
  const availablePeriods =
    cashflowSection.periods.length > 0 ? cashflowSection.periods : balanceSection.periods;

  const chosenPeriod =
    (params.periodId && availablePeriods.find((p) => p.id === params.periodId)) ||
    availablePeriods[0] ||
    null;

  const chosenId = chosenPeriod?.id ?? null;
  const currency: 'TRY' | 'USD' = report.currency === 'USD' ? 'USD' : 'TRY';
  const periodLabel = chosenPeriod ? `${chosenPeriod.label} (${chosenPeriod.endDate})` : 'Dönem Yok';

  // Extract FCF (direct or OCF - |CapEx|)
  let fcfRaw = findRowValue(cashflowSection.rows, 'freeCashFlow', chosenId);
  if (fcfRaw === null) {
    const ocf = findRowValue(cashflowSection.rows, 'operatingCashFlow', chosenId);
    const capex = findRowValue(cashflowSection.rows, 'capitalExpenditures', chosenId);
    if (ocf !== null && capex !== null) {
      fcfRaw = ocf - Math.abs(capex);
    }
  }
  const freeCashFlowMillions = fcfRaw !== null ? Number((fcfRaw / 1e6).toFixed(1)) : null;

  // Match balance period by id or closest endDate
  const balancePeriodId =
    (chosenId && balanceSection.periods.some((p) => p.id === chosenId) && chosenId) ||
    (chosenPeriod && balanceSection.periods.find((p) => p.endDate === chosenPeriod.endDate)?.id) ||
    balanceSection.periods[0]?.id ||
    null;
  const balancePeriodLabel =
    balanceSection.periods.find((p) => p.id === balancePeriodId)?.label || chosenPeriod?.label || '';

  const totalDebtRaw = findRowValue(balanceSection.rows, 'totalDebt', balancePeriodId);
  const cashRaw = findRowValue(balanceSection.rows, 'cash', balancePeriodId);
  let netDebtMillions: number | null = null;
  if (totalDebtRaw !== null) {
    netDebtMillions = Number(((totalDebtRaw - (cashRaw ?? 0)) / 1e6).toFixed(1));
  }

  const missingFields: string[] = [];
  if (freeCashFlowMillions === null) missingFields.push('Serbest Nakit Akışı (FCF)');
  if (netDebtMillions === null) missingFields.push('Net Borç');

  const sharesMillions =
    typeof params.quoteSharesMillions === 'number' &&
    Number.isFinite(params.quoteSharesMillions) &&
    params.quoteSharesMillions > 0
      ? Number(params.quoteSharesMillions.toFixed(1))
      : null;
  if (sharesMillions === null) {
    missingFields.push('Ödenmiş Sermaye / Pay Adedi (profil veya manuel girdi)');
  }

  return {
    symbol,
    periodType,
    periodId: chosenId,
    periodLabel,
    currency,
    freeCashFlowMillions,
    netDebtMillions,
    sharesOutstandingMillions: sharesMillions,
    fcfSourceLabel:
      freeCashFlowMillions !== null
        ? `${report.sourceName} • ${periodLabel}`
        : `Eksik (${report.sourceName}) — Profil değeri kullanılıyor`,
    netDebtSourceLabel:
      netDebtMillions !== null
        ? `${report.sourceName} • ${balancePeriodLabel || periodLabel}`
        : `Eksik (${report.sourceName}) — Profil değeri kullanılıyor`,
    sharesSourceLabel:
      sharesMillions !== null
        ? `Piyasa Profili (${symbol})`
        : params.fallbackSharesLabel || 'Varsayılan Profil Pay Adedi',
    availablePeriods: availablePeriods.map((p) => ({
      id: p.id,
      label: p.label,
      endDate: p.endDate,
    })),
    missingFields,
    isSourced: freeCashFlowMillions !== null || netDebtMillions !== null,
  };
}
