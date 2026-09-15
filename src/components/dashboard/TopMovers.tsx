'use client';

import Link from 'next/link';
import { useStocks } from '@/hooks/useStockData';
import { getPnLColor, getPnLSign } from '@/lib/utils/format';

export default function TopMovers() {
  const { stocks, loading } = useStocks();

  const sortedGainers = [...stocks]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 4);

  const sortedLosers = [...stocks]
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 4);

  if (loading && stocks.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-base font-semibold text-text-primary mb-4">En Çok Değişenler</h3>
        <p className="text-xs text-text-muted">Piyasa verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-base font-semibold text-text-primary mb-4">En Çok Değişenler</h3>

      {/* Gainers */}
      <div className="mb-4">
        <p className="text-xs font-medium text-success mb-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
          </svg>
          Günün Yükselenleri
        </p>
        <div className="space-y-2">
          {sortedGainers.map((stock) => (
            <Link
              key={stock.symbol}
              href={`/stocks/${stock.symbol}`}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer block"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">{stock.symbol}</span>
                <span className="text-xs text-text-muted hidden sm:inline truncate max-w-[100px]">{stock.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {stock.currency === 'USD' ? '$' : '₺'}{stock.price.toFixed(2)}
                </span>
                <span className={`text-sm font-medium ${getPnLColor(stock.changePercent)} min-w-[60px] text-right`}>
                  {getPnLSign(stock.changePercent)}{Math.abs(stock.changePercent).toFixed(2)}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Losers */}
      <div>
        <p className="text-xs font-medium text-danger mb-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
          </svg>
          Günün Düşenleri
        </p>
        <div className="space-y-2">
          {sortedLosers.map((stock) => (
            <Link
              key={stock.symbol}
              href={`/stocks/${stock.symbol}`}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer block"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">{stock.symbol}</span>
                <span className="text-xs text-text-muted hidden sm:inline truncate max-w-[100px]">{stock.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {stock.currency === 'USD' ? '$' : '₺'}{stock.price.toFixed(2)}
                </span>
                <span className={`text-sm font-medium ${getPnLColor(stock.changePercent)} min-w-[60px] text-right`}>
                  {getPnLSign(stock.changePercent)}{Math.abs(stock.changePercent).toFixed(2)}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
