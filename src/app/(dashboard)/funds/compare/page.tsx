'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InstrumentLogo } from '@/components/ui/InstrumentLogo';
import type { TefasFundInfo } from '@/lib/data/funds';
import { formatDate } from '@/lib/utils/format';
import {
  buildFundComparisonMatrix,
  MAX_COMPARISON_FUNDS,
  MIN_COMPARISON_FUNDS,
  parseComparisonCodesParam,
  type ComparableFundInput,
} from '@/lib/market/fundComparison';

const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];
const LOOKBACK_OPTIONS = [
  { days: 30, label: '1 Ay (30G)' },
  { days: 90, label: '3 Ay (90G)' },
  { days: 180, label: '6 Ay (180G)' },
  { days: 365, label: '1 Yıl (365G)' },
];

interface LoadedFundResponse {
  code: string;
  fund: ComparableFundInput | null;
  error: string | null;
}

function formatPct(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function FundCompareInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCodes = useMemo(
    () => parseComparisonCodesParam(searchParams.get('codes')),
    [searchParams]
  );
  const initialDays = useMemo(() => {
    const raw = Number(searchParams.get('days') || '90');
    return [30, 90, 180, 365].includes(raw) ? raw : 90;
  }, [searchParams]);

  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialCodes);
  const [days, setDays] = useState<number>(initialDays);
  const [loadedMap, setLoadedMap] = useState<Record<string, LoadedFundResponse>>({});
  const [loading, setLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TefasFundInfo[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setSelectedCodes(initialCodes);
  }, [initialCodes]);

  const syncUrl = useCallback(
    (nextCodes: string[], nextDays: number) => {
      const params = new URLSearchParams();
      if (nextCodes.length > 0) params.set('codes', nextCodes.join(','));
      if (nextDays !== 90) params.set('days', String(nextDays));
      const qs = params.toString();
      router.replace(qs ? `/funds/compare?${qs}` : '/funds/compare');
    },
    [router]
  );

  const handleAddCode = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code || selectedCodes.includes(code) || selectedCodes.length >= MAX_COMPARISON_FUNDS) {
        return;
      }
      const next = [...selectedCodes, code];
      setSelectedCodes(next);
      setSearchQuery('');
      setSearchResults([]);
      syncUrl(next, days);
    },
    [selectedCodes, days, syncUrl]
  );

  const handleRemoveCode = useCallback(
    (code: string) => {
      const next = selectedCodes.filter((c) => c !== code);
      setSelectedCodes(next);
      syncUrl(next, days);
    },
    [selectedCodes, days, syncUrl]
  );

  const handleChangeDays = useCallback(
    (nextDays: number) => {
      setDays(nextDays);
      syncUrl(selectedCodes, nextDays);
    },
    [selectedCodes, syncUrl]
  );

  // Fetch TEFAS search suggestions when typing
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/funds?search=${encodeURIComponent(q)}&limit=8`);
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) {
          setSearchResults(json.data);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch fund details + price history concurrently for each selected code
  useEffect(() => {
    if (selectedCodes.length === 0) {
      setLoadedMap({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      selectedCodes.map(async (code): Promise<LoadedFundResponse> => {
        try {
          const res = await fetch(`/api/funds/${encodeURIComponent(code)}?days=${days}`);
          const json = await res.json();
          if (!res.ok || !json.success || !json.data) {
            return {
              code,
              fund: null,
              error: json.error || `${code} fon verisi alınamadı.`,
            };
          }
          return {
            code,
            fund: json.data as ComparableFundInput,
            error: null,
          };
        } catch {
          return {
            code,
            fund: null,
            error: `${code} için bağlantı hatası.`,
          };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const nextMap: Record<string, LoadedFundResponse> = {};
      for (const r of results) nextMap[r.code] = r;
      setLoadedMap(nextMap);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCodes, days]);

  const loadedFunds = useMemo(
    () =>
      selectedCodes
        .map((c) => loadedMap[c]?.fund)
        .filter((f): f is ComparableFundInput => Boolean(f)),
    [selectedCodes, loadedMap]
  );

  const comparison = useMemo(() => buildFundComparisonMatrix(loadedFunds), [loadedFunds]);
  const failedEntries = useMemo(
    () =>
      selectedCodes
        .map((c) => loadedMap[c])
        .filter((entry): entry is LoadedFundResponse => Boolean(entry?.error)),
    [selectedCodes, loadedMap]
  );

  // Build aligned indexed chart geometry across common date range
  const chartGeometry = useMemo(() => {
    if (!comparison.commonDateRange.hasCommonRange || comparison.columns.length < 2) {
      return null;
    }
    const allDates = Array.from(
      new Set(comparison.columns.flatMap((c) => c.normalizedSeries.map((p) => p.date)))
    ).sort();
    if (allDates.length < 2) return null;

    const allValues = comparison.columns.flatMap((c) =>
      c.normalizedSeries.map((p) => p.indexedValue)
    );
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const span = Math.max(0.5, maxVal - minVal);
    const dateIndex = new Map(allDates.map((d, idx) => [d, idx]));

    const lines = comparison.columns.map((col, idx) => {
      const pts = col.normalizedSeries
        .map((pt) => {
          const di = dateIndex.get(pt.date) ?? 0;
          const x = (di / (allDates.length - 1)) * 100;
          const y = 92 - ((pt.indexedValue - minVal) / span) * 80;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
      return {
        code: col.code,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        points: pts,
        lastIndexed:
          col.normalizedSeries.length > 0
            ? col.normalizedSeries[col.normalizedSeries.length - 1].indexedValue
            : null,
      };
    });

    const baseLineY = 92 - ((100 - minVal) / span) * 80;
    return {
      startDate: comparison.commonDateRange.startDate!,
      endDate: comparison.commonDateRange.endDate!,
      minVal,
      maxVal,
      baseLineY: Math.max(4, Math.min(96, baseLineY)),
      lines,
    };
  }, [comparison]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8 animate-fade-in">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <Link href="/piyasalar?market=tefas" className="hover:text-text-primary transition-colors">
              TEFAS Fonları
            </Link>
            <span>/</span>
            <span className="text-text-primary font-semibold">Fon Karşılaştırma</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary">
            TEFAS Fon Karşılaştırma ({selectedCodes.length}/{MAX_COMPARISON_FUNDS})
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            İki ila dört fonu ortak tarih aralığında getiri, risk, yönetim ücreti, varlık dağılımı ve son değerleme tarihi açısından yan yana inceleyin.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {LOOKBACK_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => handleChangeDays(opt.days)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                days === opt.days
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-bg-tertiary/70 text-text-secondary hover:text-text-primary border border-border/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Fund Pills + Search Picker */}
      <div className="glass-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {selectedCodes.map((code, idx) => {
            const fund = loadedMap[code]?.fund;
            return (
              <div
                key={code}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-tertiary border border-border text-xs font-semibold text-text-primary"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                />
                <Link href={`/funds/${code}`} className="hover:text-accent transition-colors">
                  {code}
                </Link>
                {fund && (
                  <span className="text-[11px] text-text-muted max-w-[140px] truncate hidden sm:inline">
                    {fund.name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveCode(code)}
                  aria-label={`${code} fonunu karşılaştırmadan çıkar`}
                  className="text-text-muted hover:text-danger transition-colors ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {selectedCodes.length < MIN_COMPARISON_FUNDS && (
            <span className="text-xs text-warning font-medium">
              Yan yana karşılaştırma için en az {MIN_COMPARISON_FUNDS} fon seçin.
            </span>
          )}
        </div>

        {selectedCodes.length < MAX_COMPARISON_FUNDS && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Karşılaştırmaya TEFAS fon kodu veya adı ekle (ör. TCD, MAC, AFT, YAS)..."
              aria-label="Karşılaştırmaya fon ekle"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-input border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            {(searching || searchResults.length > 0) && (
              <div className="mt-2 rounded-xl border border-border bg-bg-secondary/95 divide-y divide-border/50 max-h-64 overflow-y-auto">
                {searching && (
                  <div className="px-3.5 py-2.5 text-xs text-text-muted">Fonlar aranıyor...</div>
                )}
                {!searching &&
                  searchResults.map((item) => {
                    const alreadyAdded = selectedCodes.includes(item.code);
                    return (
                      <button
                        key={item.code}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => handleAddCode(item.code)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-bg-hover/70 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <InstrumentLogo symbol={item.code} name={item.name} size="sm" />
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-text-primary block">
                              {item.code}
                            </span>
                            <span className="text-[11px] text-text-muted truncate block">
                              {item.name}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-accent shrink-0">
                          {alreadyAdded ? 'Eklendi' : '+ Ekle'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {failedEntries.length > 0 && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger space-y-1">
          {failedEntries.map((entry) => (
            <div key={entry.code}>{entry.error}</div>
          ))}
        </div>
      )}

      {loading && (
        <div className="glass-card p-6 text-center text-sm text-text-muted">
          Fon verileri ve ortak fiyat tarihçesi yükleniyor...
        </div>
      )}

      {!loading && comparison.readyToCompare && (
        <>
          {/* Common Date Range Performance Chart */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  Ortak Tarih Aralığı Normalize Performans (Baz = 100)
                </h2>
                {comparison.commonDateRange.hasCommonRange ? (
                  <p className="text-xs text-text-muted">
                    Ortak aralık:{' '}
                    <time dateTime={comparison.commonDateRange.startDate ?? undefined}>
                      {formatDate(comparison.commonDateRange.startDate!, 'tr-TR', { timeZone: 'UTC' })}
                    </time>{' '}
                    –{' '}
                    <time dateTime={comparison.commonDateRange.endDate ?? undefined}>
                      {formatDate(comparison.commonDateRange.endDate!, 'tr-TR', { timeZone: 'UTC' })}
                    </time>{' '}
                    ({comparison.commonDateRange.pointCount} işlem günü)
                  </p>
                ) : (
                  <p className="text-xs text-warning" data-testid="fund-compare-no-overlap">
                    {comparison.commonDateRange.reason}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {comparison.columns.map((col, idx) => (
                  <span key={col.code} className="inline-flex items-center gap-1.5 font-mono font-bold">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                    />
                    {col.code}:{' '}
                    <span
                      className={
                        col.commonPeriodReturnPct == null
                          ? 'text-text-muted'
                          : col.commonPeriodReturnPct >= 0
                            ? 'text-success'
                            : 'text-danger'
                      }
                    >
                      {formatPct(col.commonPeriodReturnPct)}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {chartGeometry ? (
              <div className="space-y-2">
                <div className="h-44 w-full bg-bg-tertiary/30 rounded-xl border border-border/50 p-2">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full overflow-visible"
                    role="img"
                    aria-label="Fonların ortak tarih aralığındaki normalize performans grafiği"
                  >
                    <line
                      x1="0"
                      y1={chartGeometry.baseLineY}
                      x2="100"
                      y2={chartGeometry.baseLineY}
                      stroke="currentColor"
                      strokeOpacity="0.22"
                      strokeDasharray="2 2"
                      strokeWidth="0.6"
                    />
                    {chartGeometry.lines.map((line) => (
                      <polyline
                        key={line.code}
                        fill="none"
                        stroke={line.color}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={line.points}
                      />
                    ))}
                  </svg>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>
                    Başlangıç: {formatDate(chartGeometry.startDate, 'tr-TR', { timeZone: 'UTC' })} (Baz 100)
                  </span>
                  <span>
                    Bitiş: {formatDate(chartGeometry.endDate, 'tr-TR', { timeZone: 'UTC' })} (Aralık:{' '}
                    {chartGeometry.minVal.toFixed(1)} – {chartGeometry.maxVal.toFixed(1)})
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-bg-tertiary/40 border border-border/50 text-xs text-text-muted">
                {comparison.commonDateRange.reason || 'Grafik çizimi için en az 2 fonda ortak tarih aralığı gerekiyor.'}
              </div>
            )}
          </div>

          {/* Side-by-Side Metrics Comparison Table */}
          <div className="glass-card overflow-hidden" data-testid="fund-comparison-table">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-bg-tertiary/70 border-b border-border">
                    <th className="py-3 px-4 font-semibold text-text-muted w-48">Metrik</th>
                    {comparison.columns.map((col, idx) => (
                      <th key={col.code} className="py-3 px-4 font-bold text-text-primary min-w-[160px]">
                        <Link href={`/funds/${col.code}`} className="flex items-center gap-2 hover:text-accent">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                          />
                          <div>
                            <span className="block font-black">{col.code}</span>
                            <span className="block text-[11px] font-normal text-text-muted line-clamp-1">
                              {col.category}
                            </span>
                          </div>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr>
                    <td className="py-3 px-4 font-medium text-text-secondary">
                      Ortak Aralık Getirisi
                      {comparison.commonDateRange.hasCommonRange && (
                        <span className="block text-[10px] text-text-muted font-normal">
                          {formatDate(comparison.commonDateRange.startDate!, 'tr-TR', { timeZone: 'UTC' })} –{' '}
                          {formatDate(comparison.commonDateRange.endDate!, 'tr-TR', { timeZone: 'UTC' })}
                        </span>
                      )}
                    </td>
                    {comparison.columns.map((col) => (
                      <td key={col.code} className="py-3 px-4 font-mono font-bold">
                        <span
                          className={
                            col.commonPeriodReturnPct == null
                              ? 'text-text-muted'
                              : col.commonPeriodReturnPct >= 0
                                ? 'text-success'
                                : 'text-danger'
                          }
                        >
                          {formatPct(col.commonPeriodReturnPct)}
                        </span>
                        {comparison.summaryLeaders.bestCommonReturnCode === col.code && (
                          <Badge variant="success" size="sm" className="ml-2">
                            Lider
                          </Badge>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-text-secondary">Günlük / 1 Ay / 1 Yıl Getiri</td>
                    {comparison.columns.map((col) => (
                      <td key={col.code} className="py-3 px-4 font-mono text-xs space-y-0.5">
                        <div>Günlük: {formatPct(col.dailyReturn)}</div>
                        <div>1 Ay: {formatPct(col.monthlyReturn)}</div>
                        <div>1 Yıl: {formatPct(col.yearlyReturn)}</div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-text-secondary">Risk Değeri (1–7)</td>
                    {comparison.columns.map((col) => (
                      <td key={col.code} className="py-3 px-4">
                        <span className="font-mono font-semibold text-text-primary">{col.riskDisplay}</span>
                        {comparison.summaryLeaders.lowestRiskCode === col.code && (
                          <Badge variant="info" size="sm" className="ml-2">
                            En Düşük Risk
                          </Badge>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-text-secondary">Yıllık Yönetim Ücreti</td>
                    {comparison.columns.map((col) => (
                      <td key={col.code} className="py-3 px-4 font-mono">
                        <span>{col.managementFeeDisplay}</span>
                        {comparison.summaryLeaders.lowestFeeCode === col.code && (
                          <Badge variant="success" size="sm" className="ml-2">
                            En Düşük Ücret
                          </Badge>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-text-secondary">Son Değerleme Tarihi & Fiyat</td>
                    {comparison.columns.map((col) => (
                      <td key={col.code} className="py-3 px-4">
                        <span className="block font-semibold text-text-primary">{col.navDateDisplay}</span>
                        <span className="block font-mono text-xs text-text-muted">
                          {col.price != null ? `₺${col.price.toFixed(4)}` : 'Fiyat yok'}
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-text-secondary">Kurucu & Büyüklük</td>
                    {comparison.columns.map((col) => (
                      <td key={col.code} className="py-3 px-4 text-xs">
                        <span className="block text-text-primary font-medium">{col.founder}</span>
                        <span className="block text-text-muted">{col.totalValueDisplay}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Side-by-Side Asset Allocation */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-base font-bold text-text-primary">Varlık Dağılımı Karşılaştırması</h2>
            {comparison.allocationRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="py-2 pr-4 font-semibold">Varlık Sınıfı</th>
                      {comparison.columns.map((col) => (
                        <th key={col.code} className="py-2 px-3 font-bold text-text-primary">
                          {col.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {comparison.allocationRows.map((row) => (
                      <tr key={row.category}>
                        <td className="py-2.5 pr-4 text-text-secondary font-medium">{row.category}</td>
                        {comparison.columns.map((col) => {
                          const pct = row.percentagesByCode[col.code];
                          return (
                            <td key={col.code} className="py-2.5 px-3 font-mono">
                              {pct != null ? (
                                <span className="font-semibold text-accent">%{pct.toFixed(1)}</span>
                              ) : (
                                <span className="text-text-muted">
                                  {col.allocationAvailable ? '%0.0' : 'Veri yok'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-text-muted">
                Seçili fonlar için TEFAS varlık dağılımı raporu bulunamadı.
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !comparison.readyToCompare && (
        <div className="glass-card p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-text-primary">
            En az {MIN_COMPARISON_FUNDS}, en fazla {MAX_COMPARISON_FUNDS} fon seçerek karşılaştırmayı başlatın.
          </p>
          <p className="text-xs text-text-muted">
            Yukarıdaki arama kutusundan fon kodu arayıp ekleyebilir veya TEFAS listesinden seçim yapabilirsiniz.
          </p>
          <div>
            <Link href="/piyasalar?market=tefas">
              <Button variant="secondary" size="sm">TEFAS Fon Listesine Dön</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FundComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-text-muted">Fon karşılaştırma ekranı yükleniyor...</div>
      }
    >
      <FundCompareInner />
    </Suspense>
  );
}
