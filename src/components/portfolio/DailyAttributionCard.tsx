'use client';

import React from 'react';
import { Badge, InstrumentLogo } from '@/components/ui';
import {
  formatContributionPoints,
  type DailyAttributionReport,
  type DailyAssetAttributionItem,
} from '@/lib/portfolio/dailyAttribution';
import { formatSignedPercent } from '@/lib/utils/format';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { maskCurrencyValue } from '@/lib/privacy';

export interface DailyAttributionCardProps {
  attribution?: DailyAttributionReport;
  maxPerSide?: number;
}

function ContributorList({
  title,
  tone,
  items,
  emptyLabel,
  isPrivacyMode,
}: {
  title: string;
  tone: 'positive' | 'negative';
  items: DailyAssetAttributionItem[];
  emptyLabel: string;
  isPrivacyMode: boolean;
}) {
  const isPositive = tone === 'positive';
  return (
    <div className="p-3.5 rounded-xl bg-bg-secondary/60 border border-border/70 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {title}
        </h4>
        <Badge variant={isPositive ? 'success' : 'danger'} size="sm">
          {items.length} varlık
        </Badge>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-text-muted py-2">{emptyLabel}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={`${tone}-${item.assetType}-${item.symbol}`}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-bg-card border border-border/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <InstrumentLogo symbol={item.symbol} size="xs" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-text-primary block truncate">
                    {item.symbol}
                  </span>
                  <span className="text-[10px] text-text-muted block">
                    Varlık değişimi: {formatSignedPercent(item.assetDailyReturnPercent)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`text-xs font-bold font-mono block ${
                    isPositive ? 'text-success' : 'text-danger'
                  }`}
                >
                  {maskCurrencyValue(item.contributionTry, 'TRY', isPrivacyMode, { signed: true })}
                </span>
                <span
                  className={`text-[10px] font-mono block ${
                    isPositive ? 'text-success/80' : 'text-danger/80'
                  }`}
                >
                  {formatContributionPoints(item.contributionPercentPoints)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const DailyAttributionCard: React.FC<DailyAttributionCardProps> = ({
  attribution,
  maxPerSide = 5,
}) => {
  const { isPrivacyMode } = usePrivacyMode();
  if (!attribution || attribution.allContributors.length === 0) {
    return null;
  }

  const positiveTop = attribution.positiveContributors.slice(0, maxPerSide);
  const negativeTop = attribution.negativeContributors.slice(0, maxPerSide);

  return (
    <section
      data-testid="daily-attribution-card"
      className="glass-card p-4 sm:p-5 space-y-4 border border-border/80"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-text-primary">
            Günlük Getiri Varlık Katkısı
          </h3>
          <p className="text-xs text-text-muted">
            Her pozisyonun portföy günlük sonucuna TL ve yüzde puan katkısı
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={attribution.reconciled ? 'success' : 'warning'} size="sm">
            {attribution.reconciled ? 'Portföy Sonucuyla Uzlaşıyor' : 'Fark Kontrolü'}
          </Badge>
          <span className="text-xs font-mono font-semibold text-text-primary">
            Toplam Katkı: {maskCurrencyValue(attribution.totalContributionTry, 'TRY', isPrivacyMode, { signed: true })} (
            {formatContributionPoints(attribution.totalContributionPercentPoints)})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <ContributorList
          title="En Büyük Artı Katkılar"
          tone="positive"
          items={positiveTop}
          emptyLabel="Bugün pozitif katkı sağlayan varlık yok."
          isPrivacyMode={isPrivacyMode}
        />
        <ContributorList
          title="En Büyük Eksi Katkılar"
          tone="negative"
          items={negativeTop}
          emptyLabel="Bugün negatif katkı yazan varlık yok."
          isPrivacyMode={isPrivacyMode}
        />
      </div>

      <div className="px-3 py-2 rounded-lg bg-bg-secondary/70 border border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary">
        <span>
          Katkılar Toplamı:{' '}
          <strong className="font-mono text-text-primary">
            {maskCurrencyValue(attribution.totalContributionTry, 'TRY', isPrivacyMode, { signed: true })}
          </strong>{' '}
          ({formatContributionPoints(attribution.totalContributionPercentPoints)})
        </span>
        <span>
          Günlük Portföy Sonucu:{' '}
          <strong className="font-mono text-text-primary">
            {maskCurrencyValue(attribution.totalDailyPnL, 'TRY', isPrivacyMode, { signed: true })}
          </strong>{' '}
          ({formatSignedPercent(attribution.totalDailyReturnPercent)})
        </span>
      </div>
    </section>
  );
};
