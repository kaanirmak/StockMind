import { PERIOD_LABELS, istanbulDate, type PerformancePeriod } from '@/lib/portfolio/periodPerformance';
import type { PeriodBreakdown } from '@/lib/portfolio/periodBreakdown';
import type { CashMovement, PortfolioSummary, Transaction } from '@/types/portfolio';

export type ReportExportCurrency = 'TRY' | 'USD';

export interface ReportDataDateInfo {
  isoDate: string;
  displayDate: string;
  source: 'live-quote' | 'history' | 'transaction' | 'system';
}

export interface ReportExportHoldingRow {
  symbol: string;
  assetType: 'stock' | 'fund';
  assetLabel: string;
  totalQuantity: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
}

export interface ReportExportModel {
  metadata: {
    portfolioId: string;
    portfolioName: string;
    portfolioDescription: string;
    period: PerformancePeriod;
    periodLabel: string;
    requestedCurrency: ReportExportCurrency;
    currency: ReportExportCurrency;
    currencySymbol: '₺' | '$';
    usdTryRate: number | null;
    fxUnavailable: boolean;
    fxWarning: string | null;
    dataDateIso: string;
    dataDateDisplay: string;
    isPrivacyMode: boolean;
  };
  kpis: {
    totalValue: number;
    totalCost: number;
    totalPnL: number;
    totalPnLPercent: number;
  };
  breakdown: {
    available: boolean;
    startDate: string | null;
    endDate: string;
    realizedTradePnL: number;
    unrealizedPnL: number;
    assetPricePnL: number;
    dividendsTotal: number;
    feesAndCommissionsTotal: number;
    fxImpact: number;
    netPeriodResult: number;
  } | null;
  holdings: ReportExportHoldingRow[];
  fileName: string;
}

export function formatIsoDateDisplay(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function resolveReportDataDate(input: {
  hasLivePrices?: boolean;
  periodEndDate?: string | null;
  historyDates?: readonly string[];
  transactions?: readonly Pick<Transaction, 'transactionDate'>[];
  cashMovements?: readonly Pick<CashMovement, 'movementDate'>[];
  now?: Date;
}): ReportDataDateInfo {
  const nowDate = input.now ?? new Date();
  const todayIso = istanbulDate(nowDate);
  const validIso = (raw?: string | null): string | null => {
    if (!raw || typeof raw !== 'string') return null;
    const prefix = raw.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(prefix) ? prefix : null;
  };

  if (input.hasLivePrices) {
    const chosen = validIso(input.periodEndDate) || todayIso;
    return {
      isoDate: chosen,
      displayDate: formatIsoDateDisplay(chosen),
      source: 'live-quote',
    };
  }

  let latestHistory: string | null = null;
  for (const raw of input.historyDates ?? []) {
    const iso = validIso(raw);
    if (iso && (!latestHistory || iso > latestHistory)) {
      latestHistory = iso;
    }
  }
  const periodEndIso = validIso(input.periodEndDate);
  if (periodEndIso && (!latestHistory || periodEndIso > latestHistory)) {
    latestHistory = periodEndIso;
  }
  if (latestHistory) {
    return {
      isoDate: latestHistory,
      displayDate: formatIsoDateDisplay(latestHistory),
      source: 'history',
    };
  }

  let latestTx: string | null = null;
  for (const tx of input.transactions ?? []) {
    const iso = validIso(tx.transactionDate);
    if (iso && (!latestTx || iso > latestTx)) latestTx = iso;
  }
  for (const mv of input.cashMovements ?? []) {
    const iso = validIso(mv.movementDate);
    if (iso && (!latestTx || iso > latestTx)) latestTx = iso;
  }
  if (latestTx) {
    return {
      isoDate: latestTx,
      displayDate: formatIsoDateDisplay(latestTx),
      source: 'transaction',
    };
  }

  return {
    isoDate: todayIso,
    displayDate: formatIsoDateDisplay(todayIso),
    source: 'system',
  };
}

function slugifyPortfolioName(name: string): string {
  const normalized = (name || 'portfoy')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'portfoy';
}

export function buildReportExportModel(input: {
  portfolioId: string;
  portfolioName: string;
  portfolioDescription?: string | null;
  period: PerformancePeriod;
  currency: ReportExportCurrency;
  usdTryRate: number | null;
  dataDateIso: string;
  dataDateDisplay?: string;
  summary: PortfolioSummary;
  periodBreakdown?: PeriodBreakdown | null;
  isPrivacyMode?: boolean;
}): ReportExportModel {
  const validFx =
    typeof input.usdTryRate === 'number' &&
    Number.isFinite(input.usdTryRate) &&
    input.usdTryRate > 0
      ? input.usdTryRate
      : null;

  const fxUnavailable = input.currency === 'USD' && validFx === null;
  const currency: ReportExportCurrency = fxUnavailable ? 'TRY' : input.currency;
  const divisor = currency === 'USD' && validFx !== null ? validFx : 1;
  const convert = (tryValue: number): number =>
    Number.isFinite(tryValue) ? tryValue / divisor : 0;

  const dataDateIso = input.dataDateIso;
  const dataDateDisplay = input.dataDateDisplay || formatIsoDateDisplay(dataDateIso);
  const periodLabel = PERIOD_LABELS[input.period] || input.period;
  const currencySymbol: '₺' | '$' = currency === 'USD' ? '$' : '₺';

  const holdings: ReportExportHoldingRow[] = input.summary.holdings.map((h) => ({
    symbol: h.symbol,
    assetType: h.assetType,
    assetLabel: h.assetType === 'stock' ? 'Hisse Senedi' : 'TEFAS Fon',
    totalQuantity: h.totalQuantity,
    averageCost: convert(h.averageCost),
    currentPrice: convert(h.currentPrice),
    currentValue: convert(h.currentValue),
    pnl: convert(h.pnl),
    pnlPercent: h.pnlPercent,
    weight: h.weight,
  }));

  const breakdown = input.periodBreakdown
    ? {
        available: input.periodBreakdown.available,
        startDate: input.periodBreakdown.startDate,
        endDate: input.periodBreakdown.endDate,
        realizedTradePnL: convert(input.periodBreakdown.realizedTradePnL),
        unrealizedPnL: convert(input.periodBreakdown.unrealizedPnL),
        assetPricePnL: convert(input.periodBreakdown.assetPricePnL),
        dividendsTotal: convert(input.periodBreakdown.dividendsTotal),
        feesAndCommissionsTotal: convert(input.periodBreakdown.feesAndCommissionsTotal),
        fxImpact: convert(input.periodBreakdown.fxImpact),
        netPeriodResult: convert(
          input.periodBreakdown.realizedTradePnL +
            input.periodBreakdown.unrealizedPnL +
            input.periodBreakdown.dividendsTotal -
            input.periodBreakdown.feesAndCommissionsTotal
        ),
      }
    : null;

  const fileName = `stockmind-${slugifyPortfolioName(input.portfolioName)}-${input.period}-${currency.toLowerCase()}-${dataDateIso}.csv`;

  return {
    metadata: {
      portfolioId: input.portfolioId,
      portfolioName: input.portfolioName || 'Varsayılan Portföy',
      portfolioDescription: input.portfolioDescription || 'Standart Portföy',
      period: input.period,
      periodLabel,
      requestedCurrency: input.currency,
      currency,
      currencySymbol,
      usdTryRate: validFx,
      fxUnavailable,
      fxWarning: fxUnavailable
        ? 'USD/TRY kuru doğrulanamadığı için rapor TRY cinsinden oluşturuldu.'
        : null,
      dataDateIso,
      dataDateDisplay,
      isPrivacyMode: Boolean(input.isPrivacyMode),
    },
    kpis: {
      totalValue: convert(input.summary.totalValue),
      totalCost: convert(input.summary.totalCost),
      totalPnL: convert(input.summary.totalPnL),
      totalPnLPercent: input.summary.totalPnLPercent,
    },
    breakdown,
    holdings,
    fileName,
  };
}

function sanitizeTextCell(value: string): string {
  const str = String(value ?? '');
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

function escapeCsvCell(value: string | number, isText = false): string {
  const raw = isText ? sanitizeTextCell(String(value)) : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function csvRow(cells: Array<{ value: string | number; text?: boolean }>): string {
  return cells.map((cell) => escapeCsvCell(cell.value, Boolean(cell.text))).join(',');
}

export function buildPortfolioReportCsv(model: ReportExportModel): string {
  const { metadata, kpis, breakdown, holdings } = model;
  const currency = metadata.currency;
  const maskedAmount = metadata.isPrivacyMode ? 'Gizli' : null;
  const fmtMoney = (val: number) => maskedAmount ?? val.toFixed(2);
  const fmtQty = (val: number) => (metadata.isPrivacyMode ? 'Gizli' : String(val));

  const lines: string[] = [];

  lines.push(csvRow([{ value: 'Rapor Meta', text: true }, { value: 'Değer', text: true }]));
  lines.push(csvRow([{ value: 'Portföy', text: true }, { value: metadata.portfolioName, text: true }]));
  lines.push(csvRow([{ value: 'Portföy ID', text: true }, { value: metadata.portfolioId, text: true }]));
  lines.push(csvRow([{ value: 'Dönem', text: true }, { value: `${metadata.periodLabel} (${metadata.period})`, text: true }]));
  lines.push(csvRow([{ value: 'Para Birimi', text: true }, { value: currency, text: true }]));
  lines.push(csvRow([{ value: 'Veri Tarihi', text: true }, { value: `${metadata.dataDateDisplay} (${metadata.dataDateIso})`, text: true }]));
  if (currency === 'USD' && metadata.usdTryRate) {
    lines.push(csvRow([{ value: 'USD/TRY Kuru', text: true }, { value: metadata.usdTryRate.toFixed(4) }]));
  }
  if (metadata.isPrivacyMode) {
    lines.push(csvRow([{ value: 'Gizlilik Modu', text: true }, { value: 'Etkin (tutarlar gizlendi)', text: true }]));
  }

  lines.push('');
  lines.push(csvRow([{ value: 'Özet Gösterge', text: true }, { value: 'Değer', text: true }]));
  lines.push(csvRow([{ value: `Toplam Piyasa Değeri (${currency})`, text: true }, { value: fmtMoney(kpis.totalValue), text: Boolean(maskedAmount) }]));
  lines.push(csvRow([{ value: `Toplam Yatırım Maliyeti (${currency})`, text: true }, { value: fmtMoney(kpis.totalCost), text: Boolean(maskedAmount) }]));
  lines.push(csvRow([{ value: `Net Kar / Zarar (${currency})`, text: true }, { value: fmtMoney(kpis.totalPnL), text: Boolean(maskedAmount) }]));
  lines.push(csvRow([{ value: 'Toplam Getiri (%)', text: true }, { value: kpis.totalPnLPercent.toFixed(2) }]));

  if (breakdown) {
    lines.push(csvRow([{ value: `Dönem Gerçekleşmiş Kâr (${currency})`, text: true }, { value: fmtMoney(breakdown.realizedTradePnL), text: Boolean(maskedAmount) }]));
    lines.push(csvRow([{ value: `Dönem Açık Pozisyon Sonucu (${currency})`, text: true }, { value: breakdown.available ? fmtMoney(breakdown.unrealizedPnL) : 'Veri eksik', text: !breakdown.available || Boolean(maskedAmount) }]));
    lines.push(csvRow([{ value: `Dönem Temettü (${currency})`, text: true }, { value: fmtMoney(breakdown.dividendsTotal), text: Boolean(maskedAmount) }]));
    lines.push(csvRow([{ value: `Dönem Komisyon ve Ücretler (${currency})`, text: true }, { value: fmtMoney(breakdown.feesAndCommissionsTotal), text: Boolean(maskedAmount) }]));
    lines.push(csvRow([{ value: `Dönem Kur Etkisi (${currency})`, text: true }, { value: breakdown.available ? fmtMoney(breakdown.fxImpact) : 'Veri eksik', text: !breakdown.available || Boolean(maskedAmount) }]));
  }

  lines.push('');
  lines.push(
    csvRow([
      { value: 'Sembol', text: true },
      { value: 'Varlık Türü', text: true },
      { value: 'Adet', text: true },
      { value: `Ortalama Maliyet (${currency})`, text: true },
      { value: `Son Fiyat (${currency})`, text: true },
      { value: `Toplam Değer (${currency})`, text: true },
      { value: `Net Kar/Zarar (${currency})`, text: true },
      { value: 'Getiri (%)', text: true },
      { value: 'Portföy Payı (%)', text: true },
    ])
  );

  for (const h of holdings) {
    lines.push(
      csvRow([
        { value: h.symbol, text: true },
        { value: h.assetLabel, text: true },
        { value: fmtQty(h.totalQuantity), text: metadata.isPrivacyMode },
        { value: fmtMoney(h.averageCost), text: Boolean(maskedAmount) },
        { value: fmtMoney(h.currentPrice), text: Boolean(maskedAmount) },
        { value: fmtMoney(h.currentValue), text: Boolean(maskedAmount) },
        { value: fmtMoney(h.pnl), text: Boolean(maskedAmount) },
        { value: h.pnlPercent.toFixed(2) },
        { value: h.weight.toFixed(2) },
      ])
    );
  }

  return `\uFEFF${lines.join('\n')}\n`;
}

export function formatReportAmount(
  amount: number,
  currency: ReportExportCurrency,
  options?: { signed?: boolean; decimals?: number }
): string {
  const decimals = options?.decimals ?? 2;
  const symbol = currency === 'USD' ? '$' : '₺';
  const abs = Math.abs(amount).toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (amount < 0) return `-${symbol}${abs}`;
  if (options?.signed && amount > 0) return `+${symbol}${abs}`;
  return `${symbol}${abs}`;
}
