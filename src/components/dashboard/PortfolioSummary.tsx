'use client';

import { useState, useMemo } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatPercent, getPnLSign } from '@/lib/utils/format';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'total';

export default function PortfolioSummary() {
  const { getSummary, livePrices } = usePortfolioStore();
  const summary = getSummary();
  const [period, setPeriod] = useState<TimePeriod>('total');

  const usdQuote = livePrices['USDTRY'] || livePrices['USD'];
  const usdTry = typeof usdQuote === 'number' ? usdQuote : (usdQuote && typeof usdQuote === 'object' ? usdQuote.price : 38.5);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'daily', label: 'Bugün' },
    { key: 'weekly', label: 'Bu Hafta' },
    { key: 'monthly', label: 'Bu Ay' },
    { key: 'total', label: 'Toplam' },
  ];

  const currentPeriodObj = periods.find((p) => p.key === period) || periods[3];

  // Cycle to next period on click
  const handleCyclePeriod = () => {
    const currentIndex = periods.findIndex((p) => p.key === period);
    const nextIndex = (currentIndex + 1) % periods.length;
    setPeriod(periods[nextIndex].key);
  };

  // Period P&L
  const periodData = useMemo(() => {
    switch (period) {
      case 'daily':
        return {
          label: 'Bugün',
          pnl: summary.dailyPnL,
          pnlPercent: summary.dailyPnLPercent,
        };
      case 'weekly':
        return {
          label: 'Bu Hafta',
          pnl: summary.dailyPnL * 5,
          pnlPercent: summary.dailyPnLPercent * 5,
        };
      case 'monthly':
        return {
          label: 'Bu Ay',
          pnl: summary.dailyPnL * 22,
          pnlPercent: summary.dailyPnLPercent * 22,
        };
      case 'total':
      default:
        return {
          label: 'Toplam',
          pnl: summary.totalPnL,
          pnlPercent: summary.totalPnLPercent,
        };
    }
  }, [period, summary]);

  const isPositive = periodData.pnl >= 0;

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════
          HERO CARD — Glassmorphic Purple + Green/Red Blend
          (Kârdayken Yeşil-Mor, Zarardayken Kırmızı-Mor)
          ═══════════════════════════════════════════════════════ */}
      <div
        className={`relative overflow-hidden rounded-3xl border backdrop-blur-xl transition-all duration-500 ${
          isPositive
            ? 'border-emerald-500/25 shadow-[0_12px_45px_rgba(16,185,129,0.14),0_0_80px_rgba(147,51,234,0.1)]'
            : 'border-rose-500/25 shadow-[0_12px_45px_rgba(244,63,94,0.14),0_0_80px_rgba(147,51,234,0.1)]'
        }`}
      >
        {/* Dynamic gradient background */}
        <div
          className={`absolute inset-0 transition-colors duration-700 ${
            isPositive
              ? 'bg-gradient-to-br from-[#24114f] via-[#10272b] to-[#071318]'
              : 'bg-gradient-to-br from-[#280f3a] via-[#260e1d] to-[#12050e]'
          }`}
        />

        {/* Ambient radial glows: Mor + Yeşil (veya Mor + Kırmızı) karışımı */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-700"
          style={{
            background: isPositive
              ? 'radial-gradient(ellipse at 85% 15%, rgba(16, 185, 129, 0.32) 0%, transparent 60%), radial-gradient(ellipse at 15% 85%, rgba(168, 85, 247, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 50% 50%, rgba(5, 150, 105, 0.12) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at 85% 15%, rgba(244, 63, 94, 0.32) 0%, transparent 60%), radial-gradient(ellipse at 15% 85%, rgba(168, 85, 247, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 50% 50%, rgba(225, 29, 72, 0.12) 0%, transparent 60%)',
          }}
        />

        {/* Glass reflection top highlight */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.07] to-transparent pointer-events-none" />

        {/* Subtle glass texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          }}
        />

        <div className="relative z-10 p-5 sm:p-7">
          {/* Top row: Brand Logo + Single Period Switcher */}
          <div className="flex items-center justify-between gap-3 mb-6">
            {/* StockMind Logo on dark background */}
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-white.png"
                alt="StockMind"
                className="h-8 sm:h-9 w-auto object-contain drop-shadow-[0_0_14px_rgba(168,85,247,0.45)]"
              />
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              </span>
            </div>

            {/* Single Period Pill: Click to switch / cycle directly */}
            <button
              type="button"
              onClick={handleCyclePeriod}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 border ${
                isPositive
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/25'
              }`}
              title="Dönemi değiştirmek için tıklayın"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>{currentPeriodObj.label}</span>
            </button>
          </div>

          {/* Middle Row: Main Portfolio Value & Clean P&L Text */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
              {/* Big Portfolio Value */}
              <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-white tracking-tight tabular-nums leading-none">
                {summary.totalValue > 0
                  ? `₺${summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '₺0,00'}
              </h2>

              {/* Clean K/Z text — NO button border, perfectly responsive without overflow */}
              {summary.totalValue > 0 && (
                <div
                  className={`inline-flex items-center gap-1.5 text-base sm:text-lg font-bold tabular-nums transition-colors ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    {isPositive ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                    )}
                  </svg>
                  <span>{getPnLSign(periodData.pnl)}{formatCurrency(Math.abs(periodData.pnl))}</span>
                  <span className="text-xs sm:text-sm font-semibold opacity-90">({getPnLSign(periodData.pnlPercent)}%{Math.abs(periodData.pnlPercent).toFixed(1)})</span>
                </div>
              )}
            </div>

            {/* Sub-info: Cost, USD equivalent */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/50 font-medium">
              <span>Maliyet: {formatCurrency(summary.totalCost)}</span>
              {usdTry && usdTry > 0 && (
                <>
                  <span>•</span>
                  <span>
                    ${(summary.totalValue / usdTry).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' '}
                    <span className="text-white/30">(USD/TRY: ₺{usdTry.toFixed(2)})</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          STAT CARDS ROW — Below the hero
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Daily P&L */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className={`absolute inset-0 bg-gradient-to-br ${summary.dailyPnL >= 0 ? 'from-emerald-500/10 to-transparent' : 'from-rose-500/10 to-transparent'} opacity-60`} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Günlük K/Z</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${summary.dailyPnL >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {summary.dailyPnL >= 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                  )}
                </svg>
              </div>
            </div>
            <div className={`text-lg font-bold tabular-nums ${summary.dailyPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {getPnLSign(summary.dailyPnL)}{formatCurrency(Math.abs(summary.dailyPnL))}
            </div>
            {summary.totalValue > 0 && (
              <div className={`text-xs font-medium mt-0.5 ${summary.dailyPnLPercent >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                {getPnLSign(summary.dailyPnLPercent)}{formatPercent(Math.abs(summary.dailyPnLPercent))}
              </div>
            )}
          </div>
        </div>

        {/* Total P&L */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Toplam K/Z</span>
              <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className={`text-lg font-bold tabular-nums ${summary.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {getPnLSign(summary.totalPnL)}{formatCurrency(Math.abs(summary.totalPnL))}
            </div>
            {summary.totalCost > 0 && (
              <div className={`text-xs font-medium mt-0.5 ${summary.totalPnLPercent >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                {getPnLSign(summary.totalPnLPercent)}{formatPercent(Math.abs(summary.totalPnLPercent))}
              </div>
            )}
          </div>
        </div>

        {/* Total Investment */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-secondary/10 to-transparent opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Yatırım</span>
              <div className="w-7 h-7 rounded-lg bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {formatCurrency(summary.totalCost)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {summary.holdings.length === 0 ? 'Varlık eklenmedi' : `${summary.holdings.length} varlık`}
            </div>
          </div>
        </div>

        {/* Holdings count + volume */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-info/10 to-transparent opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Hacim</span>
              <div className="w-7 h-7 rounded-lg bg-info/15 text-info flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {formatCurrency(summary.totalVolume || summary.buyVolume + summary.sellVolume)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              Alış: {formatCurrency(summary.buyVolume)} • Satış: {formatCurrency(summary.sellVolume)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
