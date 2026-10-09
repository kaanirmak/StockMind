'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatPercent, getPnLSign } from '@/lib/utils/format';

export interface PortfolioStatusWidgetProps {
  standalone?: boolean;
  initialPeriod?: 'daily' | 'monthly' | 'total';
  transparent?: boolean;
  hideFooter?: boolean;
}

export default function PortfolioStatusWidget({
  standalone = false,
  initialPeriod = 'daily',
  transparent = false,
  hideFooter = false,
}: PortfolioStatusWidgetProps) {
  const { getSummary, livePrices, fetchPortfoliosAndTransactions } = usePortfolioStore();
  const summary = getSummary();
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'total'>(initialPeriod);
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(false);

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stockmind_privacy_mode');
      if (saved === 'true') setIsPrivacyMode(true);
    } catch {}
  }, []);

  const togglePrivacyMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isPrivacyMode;
    setIsPrivacyMode(next);
    try {
      localStorage.setItem('stockmind_privacy_mode', String(next));
    } catch {}
  };

  const usdQuote = livePrices['USDTRY'] || livePrices['USD'];
  const usdTry =
    typeof usdQuote === 'number'
      ? usdQuote
      : usdQuote && typeof usdQuote === 'object'
      ? usdQuote.price
      : 38.5;

  const periodData = useMemo(() => {
    switch (period) {
      case 'daily':
        return {
          label: 'Bugün',
          pnl: summary.dailyPnL,
          pnlPercent: summary.dailyPnLPercent,
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
          label: 'Toplam Getiri',
          pnl: summary.totalPnL,
          pnlPercent: summary.totalPnLPercent,
        };
    }
  }, [period, summary]);

  const isPositive = periodData.pnl >= 0;

  const openFullApp = () => {
    if (typeof window !== 'undefined') {
      window.open('/portfolio', '_blank');
    }
  };

  return (
    <div
      className={`relative w-full rounded-3xl p-5 sm:p-6 transition-all duration-300 overflow-hidden select-none border ${
        transparent
          ? 'bg-transparent border-white/10'
          : isPositive
          ? 'bg-gradient-to-br from-[#1c0f38] via-[#0d2222] to-[#061214] border-emerald-500/30 shadow-[0_12px_40px_rgba(16,185,129,0.12)]'
          : 'bg-gradient-to-br from-[#240e32] via-[#200b1a] to-[#0e040c] border-rose-500/30 shadow-[0_12px_40px_rgba(244,63,94,0.12)]'
      }`}
    >
      {/* Ambient background glows */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 opacity-80"
        style={{
          background: isPositive
            ? 'radial-gradient(ellipse at 85% 15%, rgba(16, 185, 129, 0.28) 0%, transparent 60%), radial-gradient(ellipse at 15% 85%, rgba(168, 85, 247, 0.3) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 85% 15%, rgba(244, 63, 94, 0.28) 0%, transparent 60%), radial-gradient(ellipse at 15% 85%, rgba(168, 85, 247, 0.3) 0%, transparent 60%)',
        }}
      />

      {/* Glass sheen highlight */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Top bar: Brand + Live Dot + Period Tabs + Privacy Eye */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src="/logo-white.png"
              alt="StockMind"
              className="h-6 sm:h-7 w-auto object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]"
            />
            {/* Live Indicator */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Privacy toggle */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
              title={isPrivacyMode ? 'Tutarları Göster' : 'Tutarları Gizle'}
            >
              {isPrivacyMode ? (
                <svg className="w-3.5 h-3.5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>

            {/* Period Pills */}
            <div className="flex items-center p-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPeriod('daily')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  period === 'daily'
                    ? isPositive
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-rose-500 text-white shadow-xs'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Günlük
              </button>
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  period === 'monthly'
                    ? isPositive
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-rose-500 text-white shadow-xs'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Aylık
              </button>
              <button
                type="button"
                onClick={() => setPeriod('total')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer hidden sm:block ${
                  period === 'total'
                    ? isPositive
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-rose-500 text-white shadow-xs'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Toplam
              </button>
            </div>
          </div>
        </div>

        {/* Portfolio Value & Period P&L */}
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            Toplam Portföy Değeri
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              className={`text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums transition-all ${
                isPrivacyMode ? 'filter blur-[7px] select-none opacity-60' : ''
              }`}
            >
              {summary.totalValue > 0
                ? `₺${summary.totalValue.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '₺0,00'}
            </h2>

            {/* P&L Badge */}
            <div
              className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg border ${
                isPositive
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              } ${isPrivacyMode ? 'filter blur-[6px] select-none opacity-60' : ''}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                {isPositive ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                )}
              </svg>
              <span>{periodData.label}: {getPnLSign(periodData.pnl)}{formatCurrency(Math.abs(periodData.pnl))}</span>
              <span className="opacity-80">({getPnLSign(periodData.pnlPercent)}%{Math.abs(periodData.pnlPercent).toFixed(1)})</span>
            </div>
          </div>
        </div>

        {/* Quick Multi-Period Strip (Bugün + Bu Ay) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 text-xs">
          {/* Günlük kutu */}
          <div
            onClick={() => setPeriod('daily')}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              period === 'daily'
                ? 'bg-white/10 border-white/20'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
            }`}
          >
            <div className="text-[10px] text-white/50 font-medium">Günlük Değişim</div>
            <div
              className={`font-bold tabular-nums text-xs mt-0.5 ${
                summary.dailyPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              } ${isPrivacyMode ? 'filter blur-[5px]' : ''}`}
            >
              {getPnLSign(summary.dailyPnL)}{formatCurrency(Math.abs(summary.dailyPnL))}
              <span className="text-[10px] ml-1 opacity-80">({getPnLSign(summary.dailyPnLPercent)}%{Math.abs(summary.dailyPnLPercent).toFixed(1)})</span>
            </div>
          </div>

          {/* Aylık kutu */}
          <div
            onClick={() => setPeriod('monthly')}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              period === 'monthly'
                ? 'bg-white/10 border-white/20'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
            }`}
          >
            <div className="text-[10px] text-white/50 font-medium">Aylık Tahmini Getiri</div>
            <div
              className={`font-bold tabular-nums text-xs mt-0.5 ${
                summary.dailyPnL * 22 >= 0 ? 'text-emerald-400' : 'text-rose-400'
              } ${isPrivacyMode ? 'filter blur-[5px]' : ''}`}
            >
              {getPnLSign(summary.dailyPnL * 22)}{formatCurrency(Math.abs(summary.dailyPnL * 22))}
              <span className="text-[10px] ml-1 opacity-80">({getPnLSign(summary.dailyPnLPercent * 22)}%{(Math.abs(summary.dailyPnLPercent * 22)).toFixed(1)})</span>
            </div>
          </div>
        </div>

        {/* Footer info: USD Equivalent + Popout Link */}
        {!hideFooter && (
          <div className="flex items-center justify-between text-[11px] text-white/40 pt-1">
            <div className="flex items-center gap-1.5">
              <span>Maliyet: {isPrivacyMode ? '•••' : formatCurrency(summary.totalCost)}</span>
              {usdTry > 0 && summary.totalValue > 0 && (
                <>
                  <span>•</span>
                  <span>
                    ${isPrivacyMode ? '•••' : (summary.totalValue / usdTry).toLocaleString('en-US', { maximumFractionDigits: 1 })}
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={openFullApp}
              className="text-white/60 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>Portföy Detayı</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
