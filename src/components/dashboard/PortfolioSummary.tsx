'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatPercent, getPnLSign } from '@/lib/utils/format';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'total';

export default function PortfolioSummary() {
  const router = useRouter();
  const { getSummary, livePrices } = usePortfolioStore();
  const summary = getSummary();
  const [period, setPeriod] = useState<TimePeriod>('daily');

  const usdQuote = livePrices['USDTRY'] || livePrices['USD'];
  const usdTry = typeof usdQuote === 'number' ? usdQuote : (usdQuote && typeof usdQuote === 'object' ? usdQuote.price : 38.5);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'daily', label: 'Bugün' },
    { key: 'weekly', label: 'Bu Hafta' },
    { key: 'monthly', label: 'Bu Ay' },
    { key: 'total', label: 'Toplam' },
  ];

  const currentPeriodObj = periods.find((p) => p.key === period) || periods[0];

  // Cycle to next period on click
  const handleCyclePeriod = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = periods.findIndex((p) => p.key === period);
    const nextIndex = (currentIndex + 1) % periods.length;
    setPeriod(periods[nextIndex].key);
  };

  // Navigate to portfolio page on card click
  const handleCardClick = () => {
    router.push('/portfolio');
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
    <div>
      {/* ═══════════════════════════════════════════════════════
          HERO CARD — Glassmorphic Purple + Green/Red Blend
          (Kârdayken Yeşil-Mor, Zarardayken Kırmızı-Mor)
          Tıklandığında Portföy Sayfasına Gider
          ═══════════════════════════════════════════════════════ */}
      <div
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleCardClick();
          }
        }}
        className={`group relative overflow-hidden rounded-3xl border backdrop-blur-xl cursor-pointer transition-all duration-300 hover:scale-[1.008] active:scale-[0.995] select-none ${
          isPositive
            ? 'border-emerald-500/25 shadow-[0_12px_45px_rgba(16,185,129,0.14),0_0_80px_rgba(147,51,234,0.1)] hover:border-emerald-500/40 hover:shadow-[0_16px_50px_rgba(16,185,129,0.2),0_0_90px_rgba(147,51,234,0.15)]'
            : 'border-rose-500/25 shadow-[0_12px_45px_rgba(244,63,94,0.14),0_0_80px_rgba(147,51,234,0.1)] hover:border-rose-500/40 hover:shadow-[0_16px_50px_rgba(244,63,94,0.2),0_0_90px_rgba(147,51,234,0.15)]'
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

        <div className="relative z-10 p-4 sm:p-7">
          {/* Top row: Brand Logo + Single Period Switcher + Portföy Arrow */}
          <div className="flex items-center justify-between gap-2.5 mb-4 sm:mb-6">
            {/* StockMind Logo on dark background */}
            <div className="flex items-center gap-2">
              <img
                src="/logo-white.png"
                alt="StockMind"
                className="h-7 sm:h-9 w-auto object-contain drop-shadow-[0_0_14px_rgba(168,85,247,0.45)]"
              />
              {/* Online/Canlı Göstergesi: Daima Yeşil */}
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            </div>

            {/* Right side: Period button + Subtle Link hint */}
            <div className="flex items-center gap-2">
              {/* Single Period Pill: Click to cycle directly */}
              <button
                type="button"
                onClick={handleCyclePeriod}
                className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 border ${
                  isPositive
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500/30'
                    : 'bg-rose-500/10 hover:bg-rose-500/25 border-rose-500/30'
                }`}
                title="Dönemi değiştirmek için tıklayın"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                <span>{currentPeriodObj.label}</span>
              </button>

              {/* Portföy Sayfasına Gitme Oku */}
              <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white group-hover:bg-white/10 group-hover:translate-x-0.5 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Middle Row: Main Portfolio Value & Clean P&L Text */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/* Big Portfolio Value */}
              <h2 className="text-2xl sm:text-4xl lg:text-[44px] font-black text-white tracking-tight tabular-nums leading-none">
                {summary.totalValue > 0
                  ? `₺${summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '₺0,00'}
              </h2>

              {/* Clean K/Z text — NO button border, perfectly responsive without overflow */}
              {summary.totalValue > 0 && (
                <div
                  className={`inline-flex items-center gap-1.5 text-sm sm:text-lg font-bold tabular-nums transition-colors ${
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

            {/* Sub-info: Cost, USD equivalent, and click hint */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50 font-medium">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span>Maliyet: {formatCurrency(summary.totalCost)}</span>
                {usdTry && usdTry > 0 && (
                  <>
                    <span>•</span>
                    <span>
                      ${(summary.totalValue / usdTry).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {' '}
                      <span className="text-white/30 hidden sm:inline">(USD/TRY: ₺{usdTry.toFixed(2)})</span>
                    </span>
                  </>
                )}
              </div>

              {/* Subtle visual link hint */}
              <span className="text-[11px] text-white/35 group-hover:text-white/70 transition-colors hidden sm:inline">
                Detaylı Portföy →
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
