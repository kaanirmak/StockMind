'use client';

import { formatNumber, getPnLColor, getPnLSign } from '@/lib/utils/format';

// Demo data — will be replaced with real API data
const indices = [
  { symbol: 'XU100', name: 'BIST 100', value: 10542.38, change: 1.24, flag: '🇹🇷' },
  { symbol: 'XU030', name: 'BIST 30', value: 11203.15, change: 0.87, flag: '🇹🇷' },
  { symbol: 'SPX', name: 'S&P 500', value: 5823.47, change: -0.32, flag: '🇺🇸' },
  { symbol: 'NDX', name: 'NASDAQ 100', value: 20741.26, change: -0.58, flag: '🇺🇸' },
];

export default function MarketOverview() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Piyasa Özeti</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {indices.map((idx) => (
          <div key={idx.symbol} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{idx.flag}</span>
              <div>
                <p className="text-xs text-text-muted font-medium">{idx.symbol}</p>
                <p className="text-sm text-text-secondary">{idx.name}</p>
              </div>
            </div>
            <div className="text-lg font-bold text-text-primary">
              {formatNumber(idx.value)}
            </div>
            <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${getPnLColor(idx.change)}`}>
              {idx.change > 0 ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                </svg>
              )}
              {getPnLSign(idx.change)}{Math.abs(idx.change).toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
