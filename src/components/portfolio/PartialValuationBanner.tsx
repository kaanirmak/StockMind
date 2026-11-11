'use client';

import React from 'react';
import { Icon as UIIcon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import type { ValuationStatus } from '@/types/portfolio';

export interface PartialValuationBannerProps {
  valuationStatus?: ValuationStatus;
  missingCashRates?: string[];
  compact?: boolean;
  className?: string;
}

export function isPartialValuationStatus(
  valuationStatus?: ValuationStatus,
  missingCashRates?: string[]
): boolean {
  return Boolean(
    valuationStatus?.isPartialValuation ||
      valuationStatus?.hasMissingPrices ||
      (missingCashRates && missingCashRates.length > 0)
  );
}

export const PartialValuationBadge: React.FC<{
  valuationStatus?: ValuationStatus;
  missingCashRates?: string[];
  className?: string;
}> = ({ valuationStatus, missingCashRates, className = '' }) => {
  if (!isPartialValuationStatus(valuationStatus, missingCashRates)) {
    return null;
  }

  return (
    <Badge
      variant="warning"
      size="sm"
      dot
      className={className}
      title="Bazı varlık veya kur verileri alınamadığı için portföy toplamı kısmi maliyet/kur ile hesaplandı."
    >
      Kısmi değerleme
    </Badge>
  );
};

export const PartialValuationBanner: React.FC<PartialValuationBannerProps> = ({
  valuationStatus,
  missingCashRates = [],
  compact = false,
  className = '',
}) => {
  if (!isPartialValuationStatus(valuationStatus, missingCashRates)) {
    return null;
  }

  const missingPositions = valuationStatus?.missingPositions || [];
  const fallbackSymbols = valuationStatus?.missingPrices || [];
  const displayPositions =
    missingPositions.length > 0
      ? missingPositions
      : fallbackSymbols.map((symbol) => ({
          symbol,
          assetType: 'stock' as const,
          costValueTry: 0,
          totalQuantity: 0,
          reason: 'missing-price' as const,
        }));

  const unpricedCostTotal = valuationStatus?.unpricedCostTotal ?? 0;
  const fxList =
    missingCashRates.length > 0
      ? missingCashRates
      : valuationStatus?.missingFx
      ? ['USDTRY']
      : [];

  return (
    <div
      role="status"
      className={`${
        compact
          ? 'mt-2.5 py-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px]'
          : 'p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs'
      } flex flex-col gap-2 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-amber-400">
          <UIIcon name="warning" className="w-4 h-4" />
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
          Kısmi değerleme
        </span>
        <span className="font-medium leading-relaxed">
          {displayPositions.length > 0
            ? `${displayPositions.length} pozisyonun canlı piyasa fiyatı alınamadı; toplam değerde son bilinen işlem maliyeti kullanılıyor.`
            : 'Canlı döviz kuru alınamadığı için yabancı para varlıklar son bilinen kur ile gösteriliyor.'}
        </span>
        {unpricedCostTotal > 0 && (
          <span className="ml-auto font-mono font-semibold text-amber-200 whitespace-nowrap">
            Etkilenen maliyet: ₺{unpricedCostTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {(displayPositions.length > 0 || fxList.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pl-6">
          {displayPositions.map((pos) => (
            <span
              key={`${pos.reason}-${pos.symbol}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-500/30 font-mono text-[11px] text-amber-200"
            >
              <span className="font-bold">{pos.symbol}</span>
              <span className="text-amber-300/80">
                {pos.reason === 'missing-fx' ? '(kur eksik)' : '(fiyat eksik)'}
              </span>
              {pos.costValueTry > 0 && (
                <span className="text-amber-100/90">
                  · ₺{pos.costValueTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                </span>
              )}
            </span>
          ))}
          {fxList.map((ccy) => (
            <span
              key={`fx-${ccy}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-500/30 font-mono text-[11px] text-amber-200"
            >
              <span className="font-bold">{ccy}</span>
              <span className="text-amber-300/80">(canlı kur eksik)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
