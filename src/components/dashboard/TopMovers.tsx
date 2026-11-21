'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStocks, type StockWithQuote } from '@/hooks/useStockData';
import { formatCurrency, formatSignedPercent, getPnLColor } from '@/lib/utils/format';
import { InstrumentLogo } from '@/components/ui';

type TopMoverExchange = 'BIST' | 'NASDAQ' | 'NYSE' | 'ALL';

const EXCHANGE_OPTIONS: readonly { id: TopMoverExchange; label: string }[] = [
  { id: 'BIST', label: 'BIST' },
  { id: 'NASDAQ', label: 'NASDAQ' },
  { id: 'NYSE', label: 'NYSE' },
  { id: 'ALL', label: 'Tümü' },
];

function selectMovers(
  stocks: readonly StockWithQuote[],
  direction: 'gainers' | 'losers',
): StockWithQuote[] {
  const valid = stocks.filter(
    (s) =>
      typeof s.price === 'number' &&
      s.price > 0 &&
      typeof s.changePercent === 'number' &&
      Number.isFinite(s.changePercent),
  );
  const directional =
    direction === 'gainers'
      ? valid.filter((s) => s.changePercent > 0)
      : valid.filter((s) => s.changePercent < 0);
  return (directional.length > 0 ? directional : valid).slice(0, 4);
}

function MoverSection({
  title,
  direction,
  stocks,
  showExchange,
}: {
  title: string;
  direction: 'gainers' | 'losers';
  stocks: readonly StockWithQuote[];
  showExchange: boolean;
}) {
  const isGain = direction === 'gainers';
  return (
    <div className={isGain ? 'mb-4' : undefined}>
      <p className={`text-xs font-medium ${isGain ? 'text-success' : 'text-danger'} mb-2 flex items-center gap-1`}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={isGain ? 'M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25' : 'M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25'}
          />
        </svg>
        {title}
      </p>
      {stocks.length === 0 ? (
        <p className="text-xs text-text-muted px-2 py-1.5">Bu borsa için veri bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          {stocks.map((stock) => (
            <Link
              key={stock.symbol}
              href={`/stocks/${stock.symbol}`}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <InstrumentLogo symbol={stock.symbol} name={stock.name} size="xs" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-text-primary leading-tight">{stock.symbol}</span>
                    {showExchange && stock.exchange && (
                      <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-bg-secondary text-text-muted border border-border/60">
                        {stock.exchange}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted truncate max-w-[120px] block">{stock.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 tabular-nums shrink-0">
                <span className="text-sm text-text-secondary">
                  {formatCurrency(stock.price, stock.currency === 'USD' ? 'USD' : 'TRY')}
                </span>
                <span className={`text-sm font-medium ${getPnLColor(stock.changePercent)} min-w-[60px] text-right`}>
                  {formatSignedPercent(stock.changePercent)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopMovers() {
  const [selectedExchange, setSelectedExchange] = useState<TopMoverExchange>('BIST');
  const exchangeFilter = selectedExchange === 'ALL' ? undefined : selectedExchange;

  const { stocks: gainersRaw, loading: gainersLoading } = useStocks({
    exchange: exchangeFilter,
    sortBy: 'changePercent',
    order: 'desc',
    page: 1,
    limit: 12,
  });
  const { stocks: losersRaw, loading: losersLoading } = useStocks({
    exchange: exchangeFilter,
    sortBy: 'changePercent',
    order: 'asc',
    page: 1,
    limit: 12,
  });

  const sortedGainers = selectMovers(gainersRaw, 'gainers');
  const sortedLosers = selectMovers(losersRaw, 'losers');
  const isLoading = gainersLoading || losersLoading;
  const isInitialLoading = isLoading && gainersRaw.length === 0 && losersRaw.length === 0;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-text-primary">En Çok Değişenler</h3>
      </div>

      <div
        role="tablist"
        aria-label="Borsa seçimi"
        className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-bg-secondary/70 border border-border/60 mb-4"
      >
        {EXCHANGE_OPTIONS.map((option) => {
          const isActive = selectedExchange === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedExchange(option.id)}
              className={`min-h-8 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {isInitialLoading ? (
        <p className="text-xs text-text-muted">Piyasa verileri yükleniyor...</p>
      ) : (
        <div className={isLoading ? 'opacity-70 transition-opacity' : undefined}>
          <MoverSection
            title="Günün Yükselenleri"
            direction="gainers"
            stocks={sortedGainers}
            showExchange={selectedExchange === 'ALL'}
          />
          <MoverSection
            title="Günün Düşenleri"
            direction="losers"
            stocks={sortedLosers}
            showExchange={selectedExchange === 'ALL'}
          />
        </div>
      )}
    </div>
  );
}
