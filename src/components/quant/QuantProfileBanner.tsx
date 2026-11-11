'use client';

import React from 'react';
import type { FinancialProfileMeta } from '@/lib/quant/models';

interface QuantProfileBannerProps {
  symbol: string;
  meta: FinancialProfileMeta;
  /** True when user manually adjusted sliders/inputs away from the base profile. */
  isUserCustomized?: boolean;
  /** Optional note for AI/live quote hybrid workflows (e.g. Investment Committee). */
  committeeModeNote?: string;
}

/**
 * Displays the active Quant Lab financial profile classification (sourced vs. preset vs. synthetic),
 * reporting period when available, and provenance note at the top of each analysis tab.
 */
export default function QuantProfileBanner({
  symbol,
  meta,
  isUserCustomized = false,
  committeeModeNote,
}: QuantProfileBannerProps) {
  const isSourced = meta.kind === 'sourced';
  const containerClasses = isSourced
    ? 'border-emerald-500/30 bg-emerald-500/10'
    : 'border-amber-500/30 bg-amber-500/10';
  const badgeClasses = isSourced
    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
    : 'border-amber-500/40 bg-amber-500/15 text-amber-400';

  return (
    <div
      data-testid="quant-profile-banner"
      data-profile-kind={meta.kind}
      className={`rounded-2xl border p-3.5 sm:p-4 text-xs space-y-2 ${containerClasses}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-text-primary">{symbol}</span>
          <span className={`px-2 py-0.5 rounded-full border font-bold ${badgeClasses}`}>
            {meta.label}
          </span>
          {isUserCustomized && (
            <span className="px-2 py-0.5 rounded-full border border-accent/40 bg-accent/15 text-accent font-semibold">
              Kullanıcı Varsayımıyla Düzenlendi
            </span>
          )}
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-lg border font-semibold ${
            meta.financialPeriod
              ? 'border-emerald-500/30 bg-bg-card text-emerald-400'
              : 'border-border bg-bg-card/80 text-text-muted'
          }`}
        >
          {meta.financialPeriod
            ? `Finansal Veri Dönemi: ${meta.financialPeriod}`
            : 'Finansal Veri Dönemi: Bağlı değil (Örnek Profil)'}
        </span>
      </div>

      <p className="text-text-secondary leading-relaxed">
        {committeeModeNote || meta.summary}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
        <span>
          <strong className="text-text-secondary">Profil Kaynağı:</strong> {meta.sourceLabel}
        </span>
        <span>
          <strong className="text-text-secondary">Fiyat Girdisi:</strong> {meta.priceSourceLabel}
        </span>
      </div>
    </div>
  );
}
