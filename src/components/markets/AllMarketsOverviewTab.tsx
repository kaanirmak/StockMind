'use client';

import React from 'react';
import Link from 'next/link';
import { Icon as MarketIcon } from '@/components/ui/Icon';
import { MarketQuoteValue } from '@/components/dashboard/MarketQuoteValue';
import { TableSkeleton, InstrumentLogo, PriceStatusBadge } from '@/components/ui';
import { classifyStockPriceStatus } from '@/lib/market/priceStatus';
import type { StockWithQuote } from '@/hooks/useStockData';
import type { MarketOverviewItem } from '@/types/stock';

export type MarketTabId = 'ALL' | 'BIST' | 'TEFAS' | 'COMMODITY' | 'FOREX' | 'CRYPTO' | 'INDEX';

export interface AllMarketsOverviewTabProps {
  overviewData: {
    tickers: MarketOverviewItem[];
    sections: {
      commodity?: StockWithQuote[];
      forex?: StockWithQuote[];
      crypto?: StockWithQuote[];
      indices?: StockWithQuote[];
    } | null;
  };
  overviewLoading: boolean;
  bistStocks: StockWithQuote[];
  onMarketChange: (market: any) => void;
  isWatchlisted: (symbol: string) => boolean;
  onToggleWatchlist: (stock: StockWithQuote) => void;
}

export const AllMarketsOverviewTab: React.FC<AllMarketsOverviewTabProps> = ({
  overviewData,
  overviewLoading,
  bistStocks,
  onMarketChange,
  isWatchlisted,
  onToggleWatchlist,
}) => {
  const renderMiniAssetCard = (item: StockWithQuote, keyPrefix: string) => {
    const isPositive = (item.changePercent || 0) >= 0;
    const curr = (item.currency as string) === 'TRY' ? '₺' : (item.currency as string) === 'EUR' ? '€' : '$';
    const isStarred = isWatchlisted(item.symbol);
    const isIndexItem = item.isIndex || item.exchange === 'INDEX';
    const statusInfo = classifyStockPriceStatus(item);
    const hasObservedPrice = statusInfo.status !== 'missing';

    return (
      <div
        key={`${keyPrefix}-${item.symbol}`}
        className="glass-card p-3 hover:border-accent/40 transition-all duration-200 flex items-center justify-between gap-2 group relative"
      >
        <Link href={`/stocks/${item.symbol}`} className="flex items-center gap-2.5 min-w-0 flex-1">
          <InstrumentLogo symbol={item.symbol} name={item.name} size="sm" />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-xs sm:text-sm text-text-primary block truncate group-hover:text-accent transition-colors">
              {item.symbol}
            </span>
            <span className="text-[11px] text-text-muted truncate block">
              {item.name}
            </span>
          </div>
        </Link>

        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          {hasObservedPrice ? (
            <>
              <span className="font-mono font-bold text-xs sm:text-sm text-text-primary block">
                {(() => {
                  const validP = item.price as number;
                  if (isIndexItem) {
                    return `${validP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Pts`;
                  }
                  return `${curr}${validP < 1 ? validP.toFixed(4) : validP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
                })()}
              </span>
              <span
                className={`font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.2 rounded ${
                  isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                }`}
              >
                {isPositive ? '+' : ''}{Number(item.changePercent || 0).toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-text-muted">Fiyat yok</span>
          )}
          <PriceStatusBadge statusInfo={statusInfo} />
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWatchlist(item);
          }}
          className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors shrink-0 ${
            isStarred ? 'bg-warning/10 text-warning' : 'text-text-muted hover:bg-bg-hover hover:text-warning'
          }`}
          aria-label={`${item.symbol} ${isStarred ? 'takipten çıkar' : 'takibe al'}`}
          aria-pressed={isStarred}
        >
          <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Ticker Cards Bar */}
      {overviewData.tickers.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1 sm:grid sm:grid-cols-3 lg:grid-cols-6">
          {overviewData.tickers.map((t) => {
            return (
              <button
                type="button"
                key={t.symbol}
                onClick={() => {
                  if (t.symbol === 'XU100') onMarketChange('BIST');
                  else if (t.symbol === 'GA' || t.symbol === 'BRENT') onMarketChange('COMMODITY');
                  else if (t.symbol === 'USDTRY' || t.symbol === 'EURTRY') onMarketChange('FOREX');
                  else if (t.symbol === 'BTC') onMarketChange('CRYPTO');
                  else onMarketChange('INDEX');
                }}
                className="glass-card min-w-[148px] snap-start p-3.5 text-left hover:border-accent/40 transition-all cursor-pointer group sm:min-w-0"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MarketIcon name="chart" />
                  <span className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                    {t.name}
                  </span>
                </div>
                <MarketQuoteValue item={t} />
              </button>
            );
          })}
        </div>
      )}

      {overviewLoading && !overviewData.sections ? (
        <div className="glass-card p-8">
          <TableSkeleton rows={6} cols={4} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Block 1: Kıymetli Madenler & Emtia */}
          {overviewData.sections?.commodity && overviewData.sections.commodity.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                  <span> Kıymetli Madenler & Altın</span>
                </h3>
                <button
                  onClick={() => onMarketChange('COMMODITY')}
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Tümünü Gör (12) &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {overviewData.sections.commodity.map((item) => renderMiniAssetCard(item, 'comm'))}
              </div>
            </div>
          )}

          {/* Block 2: Döviz & Kurlar */}
          {overviewData.sections?.forex && overviewData.sections.forex.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                  <span> Döviz & Para Kurları</span>
                </h3>
                <button
                  onClick={() => onMarketChange('FOREX')}
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Tümünü Gör (9) &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {overviewData.sections.forex.map((item) => renderMiniAssetCard(item, 'fx'))}
              </div>
            </div>
          )}

          {/* Block 3: Kripto Paralar */}
          {overviewData.sections?.crypto && overviewData.sections.crypto.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                  <span>₿ Popüler Kripto Paralar</span>
                </h3>
                <button
                  onClick={() => onMarketChange('CRYPTO')}
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Tümünü Gör (14) &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {overviewData.sections.crypto.map((item) => renderMiniAssetCard(item, 'crypto'))}
              </div>
            </div>
          )}

          {/* Block 4: Küresel Borsa Endeksleri */}
          {overviewData.sections?.indices && overviewData.sections.indices.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                  <span> Küresel Borsa Endeksleri</span>
                </h3>
                <button
                  onClick={() => onMarketChange('INDEX')}
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Tümünü Gör (8) &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {overviewData.sections.indices.map((item) => renderMiniAssetCard(item, 'idx'))}
              </div>
            </div>
          )}

          {/* Block 5: BIST 100 Trend Hisseleri */}
          {bistStocks && bistStocks.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                  <span> Borsa İstanbul Trend Hisseleri</span>
                </h3>
                <button
                  onClick={() => onMarketChange('BIST')}
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Tüm BIST Hisseleri ({bistStocks.length}) &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[...bistStocks]
                  .filter((s) => (s.volume || 0) > 1_000_000)
                  .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
                  .slice(0, 6)
                  .map((item) => renderMiniAssetCard(item, 'bist-trend'))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
