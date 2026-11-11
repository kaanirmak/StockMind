'use client';

import React from 'react';
import { Badge } from '@/components/ui';
import { PERIOD_LABELS } from '@/lib/portfolio/periodPerformance';
import type { PeriodBreakdown } from '@/lib/portfolio/periodBreakdown';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { maskCurrencyValue } from '@/lib/privacy';

export interface PeriodBreakdownCardProps {
  breakdown?: PeriodBreakdown | null;
  loading?: boolean;
}

export const PeriodBreakdownCard: React.FC<PeriodBreakdownCardProps> = ({
  breakdown,
  loading = false,
}) => {
  const { isPrivacyMode } = usePrivacyMode();
  if (!breakdown) return null;

  const periodLabel = PERIOD_LABELS[breakdown.period] || breakdown.period;
  const pnlColor = (val: number) =>
    val > 0 ? 'text-success' : val < 0 ? 'text-danger' : 'text-text-primary';

  return (
    <section
      data-testid="period-breakdown-card"
      aria-label={`${periodLabel} Dönemi Kâr ve Maliyet Ayrıştırması`}
      className="glass-card p-3.5 sm:p-4 border border-border/80 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-text-primary">
            Dönem Getiri ve Maliyet Ayrıştırması ({periodLabel})
          </h3>
          <p className="text-[11px] text-text-muted">
            {breakdown.startDate
              ? `${breakdown.startDate} – ${breakdown.endDate}`
              : `Tüm zamanlar (– ${breakdown.endDate})`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {loading ? (
            <Badge variant="default" size="sm">Hesaplanıyor…</Badge>
          ) : !breakdown.available ? (
            <Badge variant="warning" size="sm">Kısmi Tarihsel Veri</Badge>
          ) : (
            <Badge variant="accent" size="sm">{periodLabel}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* 1. Gerçekleşmiş Kâr */}
        <div className="p-2.5 rounded-xl bg-bg-secondary/65 border border-border/60 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
            Gerçekleşmiş Kâr
          </span>
          <span className={`text-sm font-bold font-mono block ${pnlColor(breakdown.realizedTradePnL)}`}>
            {maskCurrencyValue(breakdown.realizedTradePnL, 'TRY', isPrivacyMode, { signed: true })}
          </span>
          <span className="text-[10px] text-text-muted block">Kapanan satış işlemleri</span>
        </div>

        {/* 2. Açık Pozisyon Sonucu */}
        <div className="p-2.5 rounded-xl bg-bg-secondary/65 border border-border/60 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
            Açık Pozisyon Sonucu
          </span>
          <span className={`text-sm font-bold font-mono block ${pnlColor(breakdown.unrealizedPnL)}`}>
            {breakdown.available
              ? maskCurrencyValue(breakdown.unrealizedPnL, 'TRY', isPrivacyMode, { signed: true })
              : 'Veri eksik'}
          </span>
          <span className="text-[10px] text-text-muted block">
            Fiyat hareketi: {breakdown.available ? maskCurrencyValue(breakdown.assetPricePnL, 'TRY', isPrivacyMode, { signed: true }) : '—'}
          </span>
        </div>

        {/* 3. Nakit Olayları & Temettü */}
        <div className="p-2.5 rounded-xl bg-bg-secondary/65 border border-border/60 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
            Temettü & Nakit
          </span>
          <span className={`text-sm font-bold font-mono block ${pnlColor(breakdown.dividendsTotal)}`}>
            {maskCurrencyValue(breakdown.dividendsTotal, 'TRY', isPrivacyMode, { signed: true })}
          </span>
          <span className="text-[10px] text-text-muted block">
            Giriş: {maskCurrencyValue(breakdown.depositsTotal, 'TRY', isPrivacyMode)} · Çıkış: {maskCurrencyValue(breakdown.withdrawalsTotal, 'TRY', isPrivacyMode)}
          </span>
        </div>

        {/* 4. Komisyon ve Ücretler */}
        <div className="p-2.5 rounded-xl bg-bg-secondary/65 border border-border/60 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
            Komisyon & Ücretler
          </span>
          <span
            className={`text-sm font-bold font-mono block ${
              breakdown.feesAndCommissionsTotal > 0 ? 'text-danger' : 'text-text-primary'
            }`}
          >
            {breakdown.feesAndCommissionsTotal > 0
              ? maskCurrencyValue(-breakdown.feesAndCommissionsTotal, 'TRY', isPrivacyMode, { signed: true })
              : maskCurrencyValue(0, 'TRY', isPrivacyMode)}
          </span>
          <span className="text-[10px] text-text-muted block">
            Komisyon: {maskCurrencyValue(breakdown.tradeCommissionsTotal, 'TRY', isPrivacyMode)} · Ücret: {maskCurrencyValue(breakdown.standaloneFeesTotal, 'TRY', isPrivacyMode)}
          </span>
        </div>

        {/* 5. Kur Etkisi */}
        <div className="p-2.5 rounded-xl bg-bg-secondary/65 border border-border/60 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
            Kur Etkisi (USD/TRY)
          </span>
          <span className={`text-sm font-bold font-mono block ${pnlColor(breakdown.fxImpact)}`}>
            {breakdown.available
              ? maskCurrencyValue(breakdown.fxImpact, 'TRY', isPrivacyMode, { signed: true })
              : 'Veri eksik'}
          </span>
          <span className="text-[10px] text-text-muted block">Döviz kuru değişim katkısı</span>
        </div>
      </div>
    </section>
  );
};
