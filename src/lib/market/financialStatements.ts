import { normalizeEventIsoDate, resolveEquityYahooTicker } from '@/lib/market/upcomingEvents';

export type StatementKind = 'income' | 'balance' | 'cashflow';
export type StatementPeriodType = 'annual' | 'quarterly';

export interface FinancialStatementPeriod {
  id: string;
  endDate: string;
  label: string;
  currency: string;
}

export interface FinancialStatementRow {
  key: string;
  label: string;
  values: Record<string, number | null>;
}

export interface FinancialStatementSection {
  kind: StatementKind;
  title: string;
  periodType: StatementPeriodType;
  currency: string;
  periods: FinancialStatementPeriod[];
  rows: FinancialStatementRow[];
}

export interface ValuationSnapshotData {
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
}

export interface FinancialStatementsReport {
  symbol: string;
  yahooTicker: string;
  status: 'ok' | 'partial' | 'empty' | 'unavailable';
  currency: string;
  sourceName: string;
  sourceUrl: string;
  secondarySourceUrl: string | null;
  secondarySourceLabel: string | null;
  fetchedAt: string;
  notice: string | null;
  annual: Record<StatementKind, FinancialStatementSection>;
  quarterly: Record<StatementKind, FinancialStatementSection>;
  valuationSnapshot?: ValuationSnapshotData;
}

export type YahooStatementRecord = Record<string, unknown>;

export interface YahooFinancialStatementsPayload {
  financialCurrency?: string | null;
  priceCurrency?: string | null;
  valuationSnapshot?: ValuationSnapshotData;
  incomeStatementHistory?: { incomeStatementHistory?: YahooStatementRecord[] };
  incomeStatementHistoryQuarterly?: { incomeStatementHistory?: YahooStatementRecord[] };
  balanceSheetHistory?: { balanceSheetStatements?: YahooStatementRecord[] };
  balanceSheetHistoryQuarterly?: { balanceSheetStatements?: YahooStatementRecord[] };
  cashflowStatementHistory?: { cashflowStatements?: YahooStatementRecord[] };
  cashflowStatementHistoryQuarterly?: { cashflowStatements?: YahooStatementRecord[] };
}

export const STATEMENT_LABELS: Record<StatementKind, string> = {
  balance: 'Bilanço',
  income: 'Gelir Tablosu',
  cashflow: 'Nakit Akış Tablosu',
};

export function extractYahooRawNumber(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (val && typeof val === 'object' && 'raw' in val) {
    const raw = (val as { raw?: unknown }).raw;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }
  return null;
}

export function isSafeSourceUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false;
  if (typeof URL === 'function') {
    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
  return /^https:\/\/[^\s]+$/i.test(rawUrl.trim());
}

export function computeFreeCashFlow(
  operatingCashFlow: number | null,
  capitalExpenditures: number | null
): number | null {
  if (operatingCashFlow === null || capitalExpenditures === null) return null;
  // Yahoo reports CapEx as negative cash outflow; deduct absolute CapEx safely in both conventions.
  return operatingCashFlow - Math.abs(capitalExpenditures);
}

export function computeTotalDebt(record: YahooStatementRecord): number | null {
  const shortLong = extractYahooRawNumber(record.shortLongTermDebt);
  const longTerm = extractYahooRawNumber(record.longTermDebt);
  const shortTerm = extractYahooRawNumber(record.shortTermDebt);
  const explicitTotal = extractYahooRawNumber(record.totalDebt);
  if (explicitTotal !== null) return explicitTotal;
  const parts = [shortLong ?? shortTerm, longTerm].filter((v): v is number => v !== null);
  if (parts.length === 0) return null;
  return parts.reduce((sum, v) => sum + v, 0);
}

function formatStatementPeriodLabel(isoDate: string, periodType: StatementPeriodType): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const year = match[1];
  const month = Number(match[2]);
  if (periodType === 'annual') return `FY ${year}`;
  const quarter = Math.min(4, Math.max(1, Math.ceil(month / 3)));
  return `${year} Ç${quarter}`;
}

export function extractYahooIsoDate(val: unknown): string | null {
  if (typeof val === 'number' || typeof val === 'string') {
    return normalizeEventIsoDate(val);
  }
  if (val && typeof val === 'object') {
    const obj = val as { raw?: unknown; fmt?: unknown };
    if (typeof obj.fmt === 'string') {
      const fromFmt = normalizeEventIsoDate(obj.fmt);
      if (fromFmt) return fromFmt;
    }
    if (typeof obj.raw === 'number' || typeof obj.raw === 'string') {
      return normalizeEventIsoDate(obj.raw);
    }
  }
  return null;
}

function normalizePeriods(
  records: readonly YahooStatementRecord[] | undefined,
  periodType: StatementPeriodType,
  currency: string
): Array<{ period: FinancialStatementPeriod; record: YahooStatementRecord }> {
  if (!Array.isArray(records) || records.length === 0) return [];
  const entries: Array<{ period: FinancialStatementPeriod; record: YahooStatementRecord }> = [];
  const seen = new Set<string>();

  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const endDate = extractYahooIsoDate(record.endDate);
    if (!endDate || seen.has(endDate)) continue;
    seen.add(endDate);
    entries.push({
      period: {
        id: endDate,
        endDate,
        label: formatStatementPeriodLabel(endDate, periodType),
        currency,
      },
      record,
    });
  }

  // Keep most recent periods first so users compare current vs prior quarters/years left-to-right.
  entries.sort((a, b) => b.period.endDate.localeCompare(a.period.endDate));
  return entries.slice(0, 6);
}

function buildRowsFromSpec(
  entries: ReadonlyArray<{ period: FinancialStatementPeriod; record: YahooStatementRecord }>,
  specs: ReadonlyArray<{ key: string; label: string; extract: (r: YahooStatementRecord) => number | null }>
): FinancialStatementRow[] {
  const rows: FinancialStatementRow[] = [];
  for (const spec of specs) {
    const values: Record<string, number | null> = {};
    let hasAnyValue = false;
    for (const entry of entries) {
      const num = spec.extract(entry.record);
      values[entry.period.id] = num;
      if (num !== null) hasAnyValue = true;
    }
    if (hasAnyValue) {
      rows.push({
        key: spec.key,
        label: spec.label,
        values,
      });
    }
  }
  return rows;
}

function buildSection(
  kind: StatementKind,
  periodType: StatementPeriodType,
  currency: string,
  records: readonly YahooStatementRecord[] | undefined
): FinancialStatementSection {
  const entries = normalizePeriods(records, periodType, currency);
  const periods = entries.map((e) => e.period);

  const specsByKind: Record<
    StatementKind,
    ReadonlyArray<{ key: string; label: string; extract: (r: YahooStatementRecord) => number | null }>
  > = {
    income: [
      { key: 'totalRevenue', label: 'Toplam Hasılat', extract: (r) => extractYahooRawNumber(r.totalRevenue) },
      { key: 'grossProfit', label: 'Brüt Kâr', extract: (r) => extractYahooRawNumber(r.grossProfit) },
      { key: 'operatingIncome', label: 'Faaliyet Kârı (EBIT)', extract: (r) => extractYahooRawNumber(r.operatingIncome) },
      { key: 'ebitda', label: 'FAVÖK (EBITDA)', extract: (r) => extractYahooRawNumber(r.ebitda) },
      { key: 'interestExpense', label: 'Finansman / Faiz Gideri', extract: (r) => extractYahooRawNumber(r.interestExpense) },
      { key: 'incomeBeforeTax', label: 'Vergi Öncesi Kâr', extract: (r) => extractYahooRawNumber(r.incomeBeforeTax) },
      { key: 'netIncome', label: 'Net Dönem Kârı', extract: (r) => extractYahooRawNumber(r.netIncome) },
    ],
    balance: [
      { key: 'totalAssets', label: 'Toplam Varlıklar', extract: (r) => extractYahooRawNumber(r.totalAssets) },
      { key: 'totalCurrentAssets', label: 'Dönen Varlıklar', extract: (r) => extractYahooRawNumber(r.totalCurrentAssets) },
      { key: 'cash', label: 'Nakit ve Benzerleri', extract: (r) => extractYahooRawNumber(r.cash) ?? extractYahooRawNumber(r.cashAndShortTermInvestments) },
      { key: 'totalLiab', label: 'Toplam Yükümlülükler', extract: (r) => extractYahooRawNumber(r.totalLiab) },
      { key: 'totalCurrentLiabilities', label: 'Kısa Vadeli Yükümlülükler', extract: (r) => extractYahooRawNumber(r.totalCurrentLiabilities) },
      { key: 'totalDebt', label: 'Toplam Finansal Borç', extract: computeTotalDebt },
      { key: 'totalStockholderEquity', label: 'Özkaynaklar', extract: (r) => extractYahooRawNumber(r.totalStockholderEquity) },
    ],
    cashflow: [
      { key: 'operatingCashFlow', label: 'İşletme Nakit Akışı', extract: (r) => extractYahooRawNumber(r.totalCashFromOperatingActivities) },
      { key: 'capitalExpenditures', label: 'Yatırım Harcamaları (CapEx)', extract: (r) => extractYahooRawNumber(r.capitalExpenditures) },
      {
        key: 'freeCashFlow',
        label: 'Serbest Nakit Akışı (FCF)',
        extract: (r) =>
          computeFreeCashFlow(
            extractYahooRawNumber(r.totalCashFromOperatingActivities),
            extractYahooRawNumber(r.capitalExpenditures)
          ),
      },
      { key: 'investingCashFlow', label: 'Yatırım Faaliyeti Nakit Akışı', extract: (r) => extractYahooRawNumber(r.totalCashflowsFromInvestingActivities) },
      { key: 'financingCashFlow', label: 'Finansman Nakit Akışı', extract: (r) => extractYahooRawNumber(r.totalCashFromFinancingActivities) },
      { key: 'dividendsPaid', label: 'Ödenen Temettüler', extract: (r) => extractYahooRawNumber(r.dividendsPaid) },
    ],
  };

  return {
    kind,
    title: STATEMENT_LABELS[kind],
    periodType,
    currency,
    periods,
    rows: entries.length > 0 ? buildRowsFromSpec(entries, specsByKind[kind]) : [],
  };
}

export function buildFinancialStatementsReport(input: {
  symbol: string;
  exchange?: string | null;
  payload?: YahooFinancialStatementsPayload | null;
  providerFailed?: boolean;
  notice?: string | null;
  now?: Date;
}): FinancialStatementsReport {
  const symbol = input.symbol.trim().toUpperCase();
  const exchange = input.exchange?.toUpperCase() || null;
  const yahooTicker = resolveEquityYahooTicker(symbol, exchange);
  const fetchedAt = (input.now ?? new Date()).toISOString();

  const fallbackCurrency =
    exchange === 'BIST' || yahooTicker.endsWith('.IS') ? 'TRY' : 'USD';
  const currency =
    input.payload?.financialCurrency?.trim().toUpperCase() ||
    input.payload?.priceCurrency?.trim().toUpperCase() ||
    fallbackCurrency;

  const sourceUrlCandidate = `https://finance.yahoo.com/quote/${encodeURIComponent(yahooTicker)}/financials/`;
  const sourceUrl = isSafeSourceUrl(sourceUrlCandidate) ? sourceUrlCandidate : 'https://finance.yahoo.com';

  const isBist = exchange === 'BIST' || yahooTicker.endsWith('.IS');
  const secondarySourceUrl = isBist
    ? `https://www.kap.org.tr/tr/bildirim-sorgu`
    : `https://www.sec.gov/edgar/searchedgar/companysearch`;
  const secondarySourceLabel = isBist ? 'KAP Bildirimleri' : 'SEC EDGAR Kayıtları';

  const annual: Record<StatementKind, FinancialStatementSection> = {
    balance: buildSection('balance', 'annual', currency, input.payload?.balanceSheetHistory?.balanceSheetStatements),
    income: buildSection('income', 'annual', currency, input.payload?.incomeStatementHistory?.incomeStatementHistory),
    cashflow: buildSection('cashflow', 'annual', currency, input.payload?.cashflowStatementHistory?.cashflowStatements),
  };

  const quarterly: Record<StatementKind, FinancialStatementSection> = {
    balance: buildSection('balance', 'quarterly', currency, input.payload?.balanceSheetHistoryQuarterly?.balanceSheetStatements),
    income: buildSection('income', 'quarterly', currency, input.payload?.incomeStatementHistoryQuarterly?.incomeStatementHistory),
    cashflow: buildSection('cashflow', 'quarterly', currency, input.payload?.cashflowStatementHistoryQuarterly?.cashflowStatements),
  };

  const nonEmptySections = [
    ...Object.values(annual),
    ...Object.values(quarterly),
  ].filter((sec) => sec.periods.length > 0 && sec.rows.length > 0).length;

  let status: FinancialStatementsReport['status'];
  let notice = input.notice ?? null;
  if (input.providerFailed && nonEmptySections === 0) {
    status = 'unavailable';
    notice = notice ?? 'Finansal tablo verileri şu anda kaynak sağlayıcıdan alınamadı.';
  } else if (nonEmptySections === 0) {
    status = 'empty';
    notice = notice ?? 'Bu hisse için dönemsel finansal tablo verisi bulunamadı.';
  } else if (nonEmptySections < 6) {
    status = 'partial';
    notice = notice ?? 'Bazı finansal tablo veya dönem kırılımları sağlayıcıda yer almıyor.';
  } else {
    status = 'ok';
  }

  return {
    symbol,
    yahooTicker,
    status,
    currency,
    sourceName: 'Yahoo Finance Şirket Finansalları',
    sourceUrl,
    secondarySourceUrl,
    secondarySourceLabel,
    fetchedAt,
    notice,
    annual,
    quarterly,
    valuationSnapshot: input.payload?.valuationSnapshot,
  };
}

export function formatStatementCompactNumber(
  value: number | null,
  currency: string
): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : `${currency} `;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}${symbol}${(abs / 1e12).toFixed(2)} Tr`;
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(2)} Mr`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(1)} Mn`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(0)} Bin`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}
