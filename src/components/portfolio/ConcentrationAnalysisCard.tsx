'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { buildPortfolioConcentrationReport, type ConcentrationBucket } from '@/lib/portfolio/concentrationReport';
import { getStockBySymbol } from '@/lib/data/stocks';
import { getFundByCode } from '@/lib/data/funds';
import type { PortfolioSummary } from '@/types/portfolio';
import { maskDisplayValue } from '@/lib/privacy';

interface ConcentrationAnalysisCardProps {
  summary: PortfolioSummary;
  isPrivacyMode?: boolean;
}

function BreakdownColumn({
  title,
  buckets,
  isPrivacyMode,
}: {
  title: string;
  buckets: ConcentrationBucket[];
  isPrivacyMode: boolean;
}) {
  return (
    <div className="p-4 rounded-xl bg-bg-tertiary/50 border border-border/60 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{title}</h4>
      {buckets.length > 0 ? (
        <div className="space-y-2.5">
          {buckets.map((b) => (
            <div key={b.label} className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-text-primary truncate">{b.label}</span>
                <span className="font-mono font-bold text-text-secondary shrink-0">
                  %{b.weightPct.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-bg-input overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, b.weightPct)}%` }}
                />
              </div>
              <span className="block text-[10px] text-text-muted font-mono">
                {maskDisplayValue(
                  `₺${b.valueTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
                  isPrivacyMode,
                  '₺••••'
                )}{' '}
                • {b.count} kalem
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">Veri yok</p>
      )}
    </div>
  );
}

export function ConcentrationAnalysisCard({
  summary,
  isPrivacyMode = false,
}: ConcentrationAnalysisCardProps) {
  const report = useMemo(
    () =>
      buildPortfolioConcentrationReport({
        summary,
        metadata: {
          getStockSector: (sym) => getStockBySymbol(sym)?.sector ?? null,
          getFundCategory: (code) => getFundByCode(code)?.category ?? null,
        },
      }),
    [summary]
  );

  const badgeVariant =
    report.concentrationLevel === 'high'
      ? 'danger'
      : report.concentrationLevel === 'moderate'
        ? 'warning'
        : 'success';

  return (
    <section
      className="glass-card p-4 sm:p-5 space-y-5"
      data-testid="concentration-analysis-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              Yoğunlaşma ve Çeşitlilik Analizi
            </h3>
            <Badge variant={badgeVariant} size="sm">
              {report.concentrationLabel}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            En büyük pozisyonlar, sektör, ülke ve varlık türü dağılımı tek raporda bir arada.
          </p>
        </div>
        <div className="text-xs font-mono text-text-muted">
          HHI Endeksi: <strong className="text-text-primary">{report.hhiIndex}</strong> • Etkin Pozisyon:{' '}
          <strong className="text-text-primary">{report.effectivePositions}</strong>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">En Büyük Pozisyon Payı</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            %{report.top1WeightPct.toFixed(1)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">İlk 3 Pozisyon Payı</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            %{report.top3WeightPct.toFixed(1)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">İlk 5 Pozisyon Payı</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            %{report.top5WeightPct.toFixed(1)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Analiz Edilen Toplam</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {maskDisplayValue(
              `₺${report.totalAnalyzedValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
              isPrivacyMode,
              '₺••••'
            )}
          </span>
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning space-y-1">
          {report.warnings.map((w, idx) => (
            <p key={idx}>• {w}</p>
          ))}
        </div>
      )}

      {/* Largest Positions Table */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          En Büyük Pozisyonlar
        </h4>
        {report.topPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="py-2 pr-3 font-semibold">Varlık</th>
                  <th className="py-2 px-3 font-semibold">Varlık Türü</th>
                  <th className="py-2 px-3 font-semibold">Sektör / Kategori</th>
                  <th className="py-2 px-3 font-semibold">Ülke / Pazar</th>
                  <th className="py-2 pl-3 font-semibold text-right">Ağırlık</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {report.topPositions.map((pos) => (
                  <tr key={pos.symbol}>
                    <td className="py-2 pr-3 font-bold text-text-primary">
                      <Link
                        href={
                          pos.assetTypeLabel === 'TEFAS Fonu'
                            ? `/funds/${pos.symbol}`
                            : `/stocks/${pos.symbol}`
                        }
                        className="hover:text-accent transition-colors"
                      >
                        {pos.symbol}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-text-secondary">{pos.assetTypeLabel}</td>
                    <td className="py-2 px-3 text-text-secondary">{pos.sector}</td>
                    <td className="py-2 px-3 text-text-secondary">{pos.country}</td>
                    <td className="py-2 pl-3 text-right font-mono font-bold text-accent">
                      %{pos.weightPct.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Değerlenmiş pozisyon bulunamadı.</p>
        )}
      </div>

      {/* Sector / Country / Asset Type Breakdown in One Report */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BreakdownColumn title="Sektör / Kategori Dağılımı" buckets={report.sectorBreakdown} isPrivacyMode={isPrivacyMode} />
        <BreakdownColumn title="Ülke / Pazar Dağılımı" buckets={report.countryBreakdown} isPrivacyMode={isPrivacyMode} />
        <BreakdownColumn title="Varlık Türü Dağılımı" buckets={report.assetTypeBreakdown} isPrivacyMode={isPrivacyMode} />
      </div>
    </section>
  );
}
