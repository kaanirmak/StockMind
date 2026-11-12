'use client';

import React, { useMemo, useState } from 'react';
import type { Transaction } from '@/types/portfolio';
import {
  generateAnnualTaxReport,
  generateTaxReportCsv,
  type TaxpayerType,
} from '@/lib/portfolio/taxReport';
import { maskDisplayValue } from '@/lib/privacy';
import { Button, Badge } from '@/components/ui';

interface TaxReportCardProps {
  transactions: Transaction[];
  usdTryRate: number | null;
  isPrivacyMode?: boolean;
}

const formatTry = (value: number, signed = false): string => {
  const absFormatted = Math.abs(value).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (signed) {
    return `${value >= 0 ? '+' : '-'}₺${absFormatted}`;
  }
  return `${value < 0 ? '-' : ''}₺${absFormatted}`;
};

export function TaxReportCard({
  transactions,
  usdTryRate,
  isPrivacyMode = false,
}: TaxReportCardProps) {
  const currentYear = new Date().getFullYear();

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1]);
    for (const tx of transactions) {
      const y = new Date(tx.transactionDate).getFullYear();
      if (Number.isFinite(y) && y >= 2000 && y <= currentYear + 1) {
        years.add(y);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  const [taxYear, setTaxYear] = useState<number>(currentYear);
  const [taxpayerType, setTaxpayerType] = useState<TaxpayerType>('individual_tr');
  const [showAllItems, setShowAllItems] = useState<boolean>(false);

  const report = useMemo(
    () =>
      generateAnnualTaxReport(transactions, {
        taxYear,
        taxpayerType,
        usdTryFallbackRate: usdTryRate && usdTryRate > 0 ? usdTryRate : 1,
      }),
    [transactions, taxYear, taxpayerType, usdTryRate]
  );

  const handleDownloadCsv = () => {
    const csvContent = generateTaxReportCsv(report);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stockmind-vergi-raporu-${taxYear}-${taxpayerType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const visibleItems = showAllItems ? report.lineItems : report.lineItems.slice(0, 8);
  const { summary } = report;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-primary">
              Yıllık Vergi Raporu (GVK / FIFO)
            </h2>
            <Badge variant="info">{taxYear}</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            BIST (%0 stopaj), yabancı hisse değer artış kazancı, temettü stopajı ve komisyon giderleri
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Vergi Yılı"
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="h-9 rounded-lg bg-bg-tertiary border border-border px-2.5 text-xs font-medium text-text-primary focus:outline-none focus:border-accent"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            aria-label="Mükellefiyet Türü"
            value={taxpayerType}
            onChange={(e) => setTaxpayerType(e.target.value as TaxpayerType)}
            className="h-9 rounded-lg bg-bg-tertiary border border-border px-2.5 text-xs font-medium text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="individual_tr">Bireysel (GVK)</option>
            <option value="corporate_tr">Kurumsal</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={report.lineItems.length === 0}
          >
            Vergi Raporu İndir (CSV)
          </Button>
        </div>
      </div>

      {/* 4 Key Tax Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-bg-tertiary/50 border border-border/60 p-3.5">
          <span className="text-[11px] text-text-muted block">BIST Gerçekleşen Kâr/Zarar</span>
          <span
            className={`text-sm font-bold font-mono mt-1 block ${
              summary.bistNetGainTry >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {maskDisplayValue(formatTry(summary.bistNetGainTry, true), isPrivacyMode, '₺••••')}
          </span>
          <span className="text-[10px] text-text-muted mt-0.5 block">
            Stopaj: %0 (GVK Geçici 67)
          </span>
        </div>

        <div className="rounded-xl bg-bg-tertiary/50 border border-border/60 p-3.5">
          <span className="text-[11px] text-text-muted block">Yabancı Hisse Net Matrah</span>
          <span
            className={`text-sm font-bold font-mono mt-1 block ${
              summary.foreignNetTaxableCapitalGainTry > 0 ? 'text-warning' : 'text-text-primary'
            }`}
          >
            {maskDisplayValue(
              formatTry(summary.foreignNetTaxableCapitalGainTry),
              isPrivacyMode,
              '₺••••'
            )}
          </span>
          <span className="text-[10px] text-text-muted mt-0.5 block">
            Kâr: {maskDisplayValue(formatTry(summary.foreignGrossGainTry), isPrivacyMode, '₺••')} · Zarar:{' '}
            {maskDisplayValue(formatTry(summary.foreignGrossLossTry), isPrivacyMode, '₺••')}
          </span>
        </div>

        <div className="rounded-xl bg-bg-tertiary/50 border border-border/60 p-3.5">
          <span className="text-[11px] text-text-muted block">Yabancı Temettü (Brüt)</span>
          <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
            {maskDisplayValue(formatTry(summary.foreignDividendsGrossTry), isPrivacyMode, '₺••••')}
          </span>
          <span className="text-[10px] text-text-muted mt-0.5 block">
            Ödenen Stopaj:{' '}
            {maskDisplayValue(
              formatTry(summary.foreignDividendsWithholdingPaidTry),
              isPrivacyMode,
              '₺••'
            )}
          </span>
        </div>

        <div className="rounded-xl bg-bg-tertiary/50 border border-border/60 p-3.5">
          <span className="text-[11px] text-text-muted block">Fon Kârı & Komisyon Gideri</span>
          <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
            {maskDisplayValue(formatTry(summary.fundNetGainTry, true), isPrivacyMode, '₺••••')}
          </span>
          <span className="text-[10px] text-text-muted mt-0.5 block">
            Düşülen Komisyon:{' '}
            {maskDisplayValue(
              formatTry(summary.totalCommissionsDeductedTry),
              isPrivacyMode,
              '₺••'
            )}
          </span>
        </div>
      </div>

      {/* Line items */}
      {report.lineItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-text-muted">
          {taxYear} yılı için gerçekleşmiş satış veya temettü işlemi bulunamadı.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="py-2 px-2 font-medium">Tarih</th>
                  <th className="py-2 px-2 font-medium">Sembol</th>
                  <th className="py-2 px-2 font-medium">Kategori</th>
                  <th className="py-2 px-2 font-medium">İşlem</th>
                  <th className="py-2 px-2 font-medium text-right">Net Kâr/Zarar</th>
                  <th className="py-2 px-2 font-medium text-right">Komisyon</th>
                  <th className="py-2 px-2 font-medium">Beyan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {visibleItems.map((item) => (
                  <tr key={item.id} className="hover:bg-bg-tertiary/30">
                    <td className="py-2 px-2 font-mono text-text-secondary">
                      {item.date.slice(0, 10)}
                    </td>
                    <td className="py-2 px-2 font-semibold text-text-primary">{item.symbol}</td>
                    <td className="py-2 px-2 text-text-secondary">{item.category}</td>
                    <td className="py-2 px-2 text-text-secondary">
                      {item.transactionType === 'sell' ? 'Satış' : 'Temettü'}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-mono font-semibold ${
                        item.netGainTry >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {maskDisplayValue(formatTry(item.netGainTry, true), isPrivacyMode, '₺•••')}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-muted">
                      {maskDisplayValue(formatTry(item.commissionTry), isPrivacyMode, '₺••')}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant={item.isTaxReturnSubject ? 'warning' : 'default'}>
                        {item.isTaxReturnSubject ? 'Beyana Tabi' : 'İstisna/Stopaj'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.lineItems.length > 8 && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setShowAllItems((prev) => !prev)}
                className="text-xs font-medium text-accent hover:underline"
              >
                {showAllItems
                  ? 'Daha az göster'
                  : `Tümünü göster (${report.lineItems.length} işlem)`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {report.notes.length > 0 && (
        <ul className="text-[11px] text-text-muted space-y-1 border-t border-border/50 pt-3">
          {report.notes.map((note, idx) => (
            <li key={idx}>• {note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
