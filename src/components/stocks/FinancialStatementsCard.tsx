'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  STATEMENT_LABELS,
  formatStatementCompactNumber,
  isSafeSourceUrl,
  type FinancialStatementsReport,
  type StatementKind,
  type StatementPeriodType,
} from '@/lib/market/financialStatements';
import {
  buildFinancialRatioHistoryReport,
  formatRatioMetricValue,
} from '@/lib/market/financialRatios';
import { Badge, Button, Skeleton } from '@/components/ui';

export interface FinancialStatementsCardProps {
  symbol: string;
  isNonEquity?: boolean;
}

const STATEMENT_ORDER: StatementKind[] = ['balance', 'income', 'cashflow'];

export const FinancialStatementsCard: React.FC<FinancialStatementsCardProps> = ({
  symbol,
  isNonEquity = false,
}) => {
  const [report, setReport] = useState<FinancialStatementsReport | null>(null);
  const [loading, setLoading] = useState(!isNonEquity);
  const [statementKind, setStatementKind] = useState<StatementKind>('balance');
  const [periodType, setPeriodType] = useState<StatementPeriodType>('annual');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!symbol || isNonEquity) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadFinancials() {
      try {
        setLoading(true);
        const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/financials`);
        if (!res.ok) {
          if (!cancelled) {
            setReport(null);
          }
          return;
        }
        const json = await res.json();
        if (!cancelled && json?.success && json.annual && json.quarterly) {
          setReport(json as FinancialStatementsReport);
        } else if (!cancelled) {
          setReport(null);
        }
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFinancials();
    return () => {
      cancelled = true;
    };
  }, [symbol, isNonEquity, reloadTick]);

  const ratiosReport = useMemo(
    () =>
      report
        ? buildFinancialRatioHistoryReport(report, periodType, report.valuationSnapshot)
        : null,
    [report, periodType]
  );

  if (isNonEquity) return null;

  const activeSection =
    report ? (periodType === 'annual' ? report.annual[statementKind] : report.quarterly[statementKind]) : null;
  const safePrimaryUrl = report && isSafeSourceUrl(report.sourceUrl) ? report.sourceUrl : null;
  const safeSecondaryUrl =
    report?.secondarySourceUrl && isSafeSourceUrl(report.secondarySourceUrl)
      ? report.secondarySourceUrl
      : null;

  return (
    <section
      data-testid="financial-statements-card"
      aria-label="Finansal Tablolar"
      className="glass-card p-4 sm:p-5 border border-border/80 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-text-primary">
              Finansal Tablolar
            </h2>
            {report && (
              <>
                <Badge variant="default" size="sm">
                  {report.currency}
                </Badge>
                <Badge variant="info" size="sm">
                  {periodType === 'annual' ? 'Yıllık' : 'Çeyreklik'}
                </Badge>
              </>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Bilanço, gelir tablosu ve nakit akışı dönem karşılaştırması
          </p>
        </div>

        {/* Source attribution links */}
        {report && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {safePrimaryUrl && (
              <a
                href={safePrimaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
              >
                <span>Kaynak: Yahoo Finance</span>
                <span aria-hidden="true">↗</span>
              </a>
            )}
            {safeSecondaryUrl && report.secondarySourceLabel && (
              <a
                href={safeSecondaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
              >
                <span>{report.secondarySourceLabel}</span>
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Controls: Statement Tabs & Period Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div
          className="flex items-center gap-1 p-1 rounded-xl bg-bg-secondary border border-border overflow-x-auto"
          role="tablist"
          aria-label="Finansal tablo türü"
        >
          {STATEMENT_ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={statementKind === kind}
              onClick={() => setStatementKind(kind)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statementKind === kind
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {STATEMENT_LABELS[kind]}
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl bg-bg-secondary border border-border self-start sm:self-auto"
          role="group"
          aria-label="Finansal tablo dönemi"
        >
          {(['annual', 'quarterly'] as StatementPeriodType[]).map((pt) => (
            <button
              key={pt}
              type="button"
              aria-pressed={periodType === pt}
              onClick={() => setPeriodType(pt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                periodType === pt
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {pt === 'annual' ? 'Yıllık' : 'Çeyreklik'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5 py-2">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-3/4 rounded-lg" />
        </div>
      ) : !report || report.status === 'unavailable' ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-warning">Finansal Tablo Verisi Alınamadı</p>
            <p className="text-xs text-text-muted">
              {report?.notice || 'Sağlayıcı geçici olarak yanıt vermiyor.'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReloadTick((v) => v + 1)}
          >
            Yeniden Dene
          </Button>
        </div>
      ) : !activeSection || activeSection.periods.length === 0 || activeSection.rows.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-bg-secondary/50 p-4 text-xs text-text-muted">
          <p className="font-medium text-text-secondary">
            {STATEMENT_LABELS[statementKind]} ({periodType === 'annual' ? 'Yıllık' : 'Çeyreklik'}) için doğrulanmış dönem satırı bulunamadı.
          </p>
          {report.notice && <p className="mt-1">{report.notice}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-secondary/90 text-text-muted uppercase border-b border-border/70">
                <tr>
                  <th className="py-2.5 px-3 font-semibold min-w-[180px]">Kalem ({activeSection.currency})</th>
                  {activeSection.periods.map((period) => (
                    <th key={period.id} className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                      <span className="block text-text-primary">{period.label}</span>
                      <span className="block text-[10px] font-mono text-text-muted font-normal">
                        {period.endDate}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {activeSection.rows.map((row) => (
                  <tr key={row.key} className="hover:bg-bg-hover/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-text-primary">{row.label}</td>
                    {activeSection.periods.map((period) => {
                      const val = row.values[period.id] ?? null;
                      const isNeg = typeof val === 'number' && val < 0;
                      return (
                        <td
                          key={period.id}
                          className={`py-2.5 px-3 text-right font-mono font-semibold whitespace-nowrap ${
                            val === null
                              ? 'text-text-muted'
                              : isNeg
                              ? 'text-danger'
                              : 'text-text-primary'
                          }`}
                        >
                          {formatStatementCompactNumber(val, activeSection.currency)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-muted">
            Birimler şirket bilançosunda açıklanan para birimi ({activeSection.currency}) cinsindendir. Eksik kalemler tahmin edilmez ve — ile gösterilir.
          </p>
        </div>
      )}

      {/* Historical Financial Ratios & Method Disclosure (PIY-07) */}
      {!loading && report && report.status !== 'unavailable' && ratiosReport && (
        <div
          data-testid="financial-ratios-history"
          className="pt-4 border-t border-border/70 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-text-primary">
                Finansal Oran Geçmişi ve Hesaplama Yöntemi
              </h3>
              <p className="text-[11px] text-text-muted">
                Net kâr marjı, ROE, borç/özsermaye ve serbest nakit akışı marjının {periodType === 'annual' ? 'yıllık' : 'çeyreklik'} serisi
              </p>
            </div>
            <Badge variant="default" size="sm">
              {periodType === 'annual' ? 'Yıllık Seri' : 'Çeyreklik Seri'}
            </Badge>
          </div>

          {ratiosReport.valuationMetrics.some((m) => m.value !== null) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ratiosReport.valuationMetrics.map((metric) => (
                <div
                  key={metric.key}
                  className="p-2.5 rounded-xl bg-bg-secondary/65 border border-border/60 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-text-secondary">{metric.label}</span>
                    <span className="text-sm font-bold font-mono text-text-primary">
                      {metric.value !== null ? `${metric.value.toFixed(2)}×` : '—'}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-text-muted">{metric.formula}</p>
                  <p className="text-[10px] text-text-muted">{metric.methodNote}</p>
                </div>
              ))}
            </div>
          )}

          {ratiosReport.rows.length > 0 && ratiosReport.periods.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-secondary/90 text-text-muted uppercase border-b border-border/70">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold min-w-[175px]">Finansal Oran</th>
                    {ratiosReport.periods.map((period) => (
                      <th key={period.id} className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                        <span className="block text-text-primary">{period.label}</span>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-semibold min-w-[210px]">Formül / Yöntem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ratiosReport.rows.map((row) => (
                    <tr key={row.key} className="hover:bg-bg-hover/40 transition-colors align-top">
                      <td className="py-2.5 px-3 font-medium text-text-primary">{row.label}</td>
                      {ratiosReport.periods.map((period) => {
                        const val = row.values[period.id] ?? null;
                        const isNeg = typeof val === 'number' && val < 0;
                        return (
                          <td
                            key={period.id}
                            className={`py-2.5 px-3 text-right font-mono font-semibold whitespace-nowrap ${
                              val === null
                                ? 'text-text-muted'
                                : isNeg
                                ? 'text-danger'
                                : 'text-text-primary'
                            }`}
                          >
                            {formatRatioMetricValue(val, row.unit)}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-[11px] text-text-muted">
                        <span className="block font-mono text-text-secondary">{row.formula}</span>
                        <span className="block mt-0.5">{row.methodNote}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-text-muted">{ratiosReport.notice}</p>
          )}
        </div>
      )}
    </section>
  );
};
