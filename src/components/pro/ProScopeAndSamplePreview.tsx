'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui';
import {
  PRO_DATA_SCOPE_SUMMARY,
  PRO_PLAN_CAPABILITIES,
  PRO_SAMPLE_ANALYSIS_PREVIEW,
} from '@/lib/pro/planOverview';

interface ProScopeAndSamplePreviewProps {
  compact?: boolean;
  defaultOpenSample?: boolean;
}

export function ProScopeAndSamplePreview({
  compact = false,
  defaultOpenSample = false,
}: ProScopeAndSamplePreviewProps) {
  const [showSample, setShowSample] = useState(defaultOpenSample);

  return (
    <div
      data-testid="pro-scope-and-sample-preview"
      className="space-y-3 text-left"
    >
      {!compact && (
        <div className="rounded-2xl border border-border/60 bg-bg-secondary/40 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-text-primary">
              Plan & Veri Kapsamı Karşılaştırması
            </span>
            <Badge variant="info" size="sm">Üyelik Öncesi Bilgilendirme</Badge>
          </div>
          <div className="space-y-2">
            {PRO_PLAN_CAPABILITIES.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-border/50 bg-bg-card/70 p-2.5 text-[11px] space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-text-primary">{row.feature}</span>
                  <span className="text-amber-400 font-semibold">Pro: {row.proScope}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-text-muted">
                  <span>Standart: {row.freeScope}</span>
                </div>
                <p className="text-text-secondary">
                  <strong className="text-text-primary">Veri kapsamı:</strong> {row.dataScope}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/50 bg-bg-secondary/50 p-2.5 text-[11px] text-text-muted space-y-1">
            {PRO_DATA_SCOPE_SUMMARY.exclusionsAndLimits.map((line) => (
              <p key={line}>• {line}</p>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-accent/25 bg-accent/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="accent" size="sm">
              {PRO_SAMPLE_ANALYSIS_PREVIEW.badgeLabel}
            </Badge>
            <span className="text-xs font-semibold text-text-primary">
              Örnek Pro Çıktı Formatı
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSample((prev) => !prev)}
            className="text-xs font-semibold text-accent hover:underline cursor-pointer"
          >
            {showSample ? 'Örnek çıktıyı gizle' : 'Örnek analizi önizle'}
          </button>
        </div>

        {showSample && (
          <div
            data-testid="pro-sample-output-preview"
            className="rounded-xl border border-border/70 bg-bg-card p-3 space-y-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
              <span className="font-mono font-bold text-text-primary">
                {PRO_SAMPLE_ANALYSIS_PREVIEW.symbolLabel}
              </span>
              <span className="text-[11px] text-text-muted">
                {PRO_SAMPLE_ANALYSIS_PREVIEW.asOfLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2 space-y-1">
                <span className="font-semibold text-emerald-400">Doğrulanan Veri Alanları</span>
                {PRO_SAMPLE_ANALYSIS_PREVIEW.verifiedDataLines.map((line) => (
                  <p key={line} className="text-text-secondary">• {line}</p>
                ))}
              </div>
              <div className="rounded-lg bg-warning/5 border border-warning/20 p-2 space-y-1">
                <span className="font-semibold text-warning">Model Varsayımları</span>
                {PRO_SAMPLE_ANALYSIS_PREVIEW.assumptionLines.map((line) => (
                  <p key={line} className="text-text-secondary">• {line}</p>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              {PRO_SAMPLE_ANALYSIS_PREVIEW.committeeSummary.map((entry) => (
                <div
                  key={entry.persona}
                  className="rounded-lg border border-border/50 bg-bg-secondary/40 px-2.5 py-1.5 text-[11px]"
                >
                  <span className="font-semibold text-text-primary">{entry.persona}</span>{' '}
                  <span className="text-accent font-semibold">({entry.stance})</span>:{' '}
                  <span className="text-text-secondary">{entry.rationale}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-text-muted italic">
              {PRO_SAMPLE_ANALYSIS_PREVIEW.disclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
