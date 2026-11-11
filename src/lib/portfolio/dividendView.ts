import type { Holding, Transaction } from '@/types/portfolio';
import type { UpcomingEventItem } from '@/lib/market/upcomingEvents';
import { cleanSymbol, type PriceQuote } from '@/lib/portfolio/calculations';

export interface RealizedDividendEntry {
  id: string;
  symbol: string;
  paymentDate: string;
  amountNative: number;
  currency: 'TRY' | 'USD';
  exchangeRateUsed: number;
  amountTry: number;
  missingFxRate: boolean;
  notes: string | null;
}

export interface AnnouncedDividendEntry {
  id: string;
  symbol: string;
  eventType: 'ex_dividend' | 'dividend';
  typeLabel: string;
  eventDate: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  verified: boolean;
  holdingShares: number;
  details: string | null;
}

export interface ProjectedDividendEstimate {
  symbol: string;
  estimatedAnnualTry: number;
  holdingShares: number;
  basisLabel: string;
  yieldPercent: number | null;
  confidenceNote: string;
}

export interface DividendOverviewReport {
  realized: {
    entries: RealizedDividendEntry[];
    totalTry: number;
    missingFxCount: number;
  };
  announced: {
    entries: AnnouncedDividendEntry[];
    sourcesUnavailable: string[];
  };
  estimates: {
    entries: ProjectedDividendEstimate[];
    totalAnnualTry: number;
    disclaimer: string;
  };
}

function getUsdTryFallback(prices: Record<string, PriceQuote | number>): number | null {
  const q = prices['USDTRY'] ?? prices['USD'];
  const val = typeof q === 'number' ? q : q?.price;
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : null;
}

/**
 * Separates realized dividend payments, officially announced upcoming dividend/ex-dividend events,
 * and optional yield/history-based estimates without conflating confirmed vs projected cash.
 */
export function buildDividendOverviewReport(input: {
  transactions: readonly Transaction[];
  holdings: readonly Holding[];
  upcomingEventsBySymbol: Record<string, readonly UpcomingEventItem[]>;
  unavailableSymbols?: readonly string[];
  dividendYieldBySymbol?: Record<string, number | null | undefined>;
  livePrices?: Record<string, PriceQuote | number>;
  today?: string;
}): DividendOverviewReport {
  const today =
    input.today ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const prices = input.livePrices ?? {};
  const usdTry = getUsdTryFallback(prices);

  // 1. Realized dividend transactions (confirmed ledger payments <= today)
  const realizedEntries: RealizedDividendEntry[] = [];
  let realizedTotalTry = 0;
  let missingFxCount = 0;

  for (const tx of input.transactions) {
    if (tx.transactionType !== 'dividend') continue;
    const payDate = (tx.transactionDate || '').slice(0, 10);
    if (!payDate || payDate > today) continue;

    const cleaned = cleanSymbol(tx.symbol);
    const isUsd =
      (tx.currency || '').toUpperCase() === 'USD' ||
      tx.exchange === 'NASDAQ' ||
      tx.exchange === 'NYSE' ||
      cleaned.exchange === 'NASDAQ' ||
      cleaned.exchange === 'NYSE';

    const grossNative =
      Math.max(0, Number(tx.price) || 0) * (tx.quantity > 0 ? Number(tx.quantity) : 1) -
      (Number(tx.commission) || 0);
    if (grossNative <= 0) continue;

    let rate = 1;
    let missingFxRate = false;
    if (isUsd) {
      if (tx.exchangeRate && Number.isFinite(tx.exchangeRate) && tx.exchangeRate > 0) {
        rate = tx.exchangeRate;
      } else if (usdTry) {
        rate = usdTry;
        missingFxRate = true;
      } else {
        rate = 0;
        missingFxRate = true;
      }
    }

    if (missingFxRate) missingFxCount++;
    const amountTry = Number((grossNative * rate).toFixed(2));
    realizedTotalTry += amountTry;

    realizedEntries.push({
      id: tx.id,
      symbol: cleaned.symbol || tx.symbol.toUpperCase(),
      paymentDate: payDate,
      amountNative: Number(grossNative.toFixed(2)),
      currency: isUsd ? 'USD' : 'TRY',
      exchangeRateUsed: rate,
      amountTry,
      missingFxRate,
      notes: tx.notes ?? null,
    });
  }

  realizedEntries.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  // 2. Officially announced upcoming dividend / ex-dividend calendar events (>= today)
  const holdingsBySymbol = new Map<string, Holding>();
  for (const h of input.holdings) {
    if (h.totalQuantity > 0) {
      holdingsBySymbol.set(cleanSymbol(h.symbol).symbol || h.symbol.toUpperCase(), h);
    }
  }

  const announcedEntries: AnnouncedDividendEntry[] = [];
  const announcedSymbols = new Set<string>();

  for (const [rawSym, items] of Object.entries(input.upcomingEventsBySymbol ?? {})) {
    const sym = cleanSymbol(rawSym).symbol || rawSym.toUpperCase();
    const holding = holdingsBySymbol.get(sym);
    for (const ev of items ?? []) {
      if (ev.type !== 'dividend' && ev.type !== 'ex_dividend') continue;
      if (!ev.eventDate || ev.eventDate < today) continue;
      if (!ev.verified) continue;

      announcedSymbols.add(sym);
      announcedEntries.push({
        id: ev.id,
        symbol: sym,
        eventType: ev.type,
        typeLabel: ev.typeLabel,
        eventDate: ev.eventDate,
        title: ev.title,
        source: ev.source,
        sourceUrl: ev.sourceUrl ?? null,
        verified: ev.verified,
        holdingShares: holding?.totalQuantity ?? 0,
        details: ev.details ?? null,
      });
    }
  }

  announcedEntries.sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  // 3. Projected estimates (strictly separated and disclosed as non-guaranteed)
  const estimates: ProjectedDividendEstimate[] = [];
  let totalAnnualTry = 0;

  for (const [sym, holding] of holdingsBySymbol.entries()) {
    if (holding.currentValue <= 0 || holding.totalQuantity <= 0) continue;

    const explicitYield = input.dividendYieldBySymbol?.[sym];
    const hasExplicitYield =
      typeof explicitYield === 'number' && Number.isFinite(explicitYield) && explicitYield > 0;

    if (hasExplicitYield) {
      const estimatedAnnualTry = Number(
        ((holding.currentValue * explicitYield) / 100).toFixed(2)
      );
      totalAnnualTry += estimatedAnnualTry;
      estimates.push({
        symbol: sym,
        estimatedAnnualTry,
        holdingShares: holding.totalQuantity,
        basisLabel: `Piyasa temettü verimi (%${explicitYield.toFixed(2)})`,
        yieldPercent: Number(explicitYield.toFixed(2)),
        confidenceNote:
          'Tahmin geçmiş verime dayanır; şirket yönetim kurulu kararına bağlı olup garanti değildir.',
      });
      continue;
    }

    // Secondary factual fallback: trailing 365-day realized dividends received on this symbol
    const oneYearAgoMs = Date.parse(`${today}T12:00:00Z`) - 365 * 86_400_000;
    const oneYearAgoIso = new Date(oneYearAgoMs).toISOString().slice(0, 10);
    const ttmPaidTry = realizedEntries
      .filter((r) => r.symbol === sym && r.paymentDate >= oneYearAgoIso)
      .reduce((sum, r) => sum + r.amountTry, 0);

    if (ttmPaidTry > 0) {
      const impliedYield = Number(((ttmPaidTry / holding.currentValue) * 100).toFixed(2));
      totalAnnualTry += ttmPaidTry;
      estimates.push({
        symbol: sym,
        estimatedAnnualTry: Number(ttmPaidTry.toFixed(2)),
        holdingShares: holding.totalQuantity,
        basisLabel: 'Son 12 ay gerçekleşen ödemeler toplamı',
        yieldPercent: impliedYield,
        confidenceNote: announcedSymbols.has(sym)
          ? 'Gelecek ödeme takvimde ilan edilmiştir; tutar geçmiş 12 ay bazlı projeksiyondur.'
          : 'Henüz resmi yeni ödeme ilanı yoktur; geçmiş 12 ay bazlı tahmindir.',
      });
    }
  }

  estimates.sort((a, b) => b.estimatedAnnualTry - a.estimatedAnnualTry);

  return {
    realized: {
      entries: realizedEntries,
      totalTry: Number(realizedTotalTry.toFixed(2)),
      missingFxCount,
    },
    announced: {
      entries: announcedEntries,
      sourcesUnavailable: [...(input.unavailableSymbols ?? [])].sort(),
    },
    estimates: {
      entries: estimates,
      totalAnnualTry: Number(totalAnnualTry.toFixed(2)),
      disclaimer:
        'Tahminler geçmiş ödeme veya piyasa temettü verimine dayalı göstergedir; kesinleşmiş veya ilan edilmiş nakit akışı değildir.',
    },
  };
}
