'use client';
import QuantSymbolSelect from './QuantSymbolSelect';
import QuantProfileBanner from './QuantProfileBanner';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  Info,
} from '@/components/quant/QuantIcons';
import {
  getFinancialProfile,
  PRESET_FINANCIAL_PROFILES,
} from '@/lib/quant/models';
import {
  evaluateHealthFromVerifiedFinancials,
  type HealthUsedItem,
} from '@/lib/quant/verifiedHealth';
import type {
  FinancialStatementsReport,
  StatementPeriodType,
} from '@/lib/market/financialStatements';
import { Holding } from '@/types/portfolio';

function HealthProvenanceBox({
  testId,
  sourceName,
  isSourced,
  periodsUsed,
  usedItems,
  missingInputs,
}: {
  testId: string;
  sourceName: string;
  isSourced: boolean;
  periodsUsed: string[];
  usedItems: HealthUsedItem[];
  missingInputs: string[];
}) {
  return (
    <div
      data-testid={testId}
      className="p-3 rounded-xl bg-bg-secondary/45 border border-border/80 space-y-2 text-[11px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-text-secondary">
          Kaynak:{' '}
          <span className={isSourced ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {sourceName}
          </span>
        </span>
        <span className="text-text-muted">
          Dönemler: {periodsUsed.length > 0 ? periodsUsed.join(' • ') : 'Dönem Yok'}
        </span>
      </div>

      {usedItems.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted block">
            Kullanılan Finansal Kalemler ({usedItems.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {usedItems.map((item, idx) => (
              <span
                key={`${item.key}-${idx}`}
                className="px-2 py-0.5 rounded-md bg-bg-card border border-border/70 text-text-secondary"
              >
                <span className="font-semibold text-text-primary">{item.label}</span>:{' '}
                <span className="font-mono text-accent">{item.formattedValue}</span>{' '}
                <span className="text-[10px] text-text-muted">({item.periodLabel})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {missingInputs.length > 0 && (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200/90 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider block">
            Eksik Girdiler ({missingInputs.length})
          </span>
          <ul className="list-disc pl-4 space-y-0.5">
            {missingInputs.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface FinancialHealthTabProps {
  selectedSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
  portfolioStocks?: Holding[];
}

export default function FinancialHealthTab({
  selectedSymbol,
  onSelectSymbol,
  portfolioStocks = [],
}: FinancialHealthTabProps) {
  const initialSym = selectedSymbol || portfolioStocks[0]?.symbol || 'THYAO';
  const [currentSymbol, setCurrentSymbol] = useState<string>(initialSym);
  const [periodType, setPeriodType] = useState<StatementPeriodType>('annual');
  const [financialReport, setFinancialReport] = useState<FinancialStatementsReport | null>(null);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState<boolean>(false);

  // Active holding in portfolio if user owns this stock
  const activeHolding = useMemo(() => {
    return portfolioStocks.find(
      (h) => h.symbol.toUpperCase() === currentSymbol.toUpperCase()
    );
  }, [portfolioStocks, currentSymbol]);

  useEffect(() => {
    if (selectedSymbol && selectedSymbol.toUpperCase() !== currentSymbol.toUpperCase()) {
      setCurrentSymbol(selectedSymbol.toUpperCase());
    }
  }, [selectedSymbol]);

  useEffect(() => {
    const cleanSym = currentSymbol.trim().toUpperCase();
    if (!cleanSym) return;
    const controller = new AbortController();
    setIsLoadingFinancials(true);
    fetch(`/api/stocks/${encodeURIComponent(cleanSym)}/financials`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FinancialStatementsReport | null) => {
        if (!controller.signal.aborted) {
          setFinancialReport(data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFinancialReport(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingFinancials(false);
        }
      });

    return () => controller.abort();
  }, [currentSymbol]);

  const handleSelect = (sym: string) => {
    const cleanSym = sym.trim().toUpperCase();
    setCurrentSymbol(cleanSym);
    onSelectSymbol?.(cleanSym);
  };

  const holdingPrice = activeHolding?.originalPrice ?? activeHolding?.currentPrice;
  const profile = useMemo(
    () => getFinancialProfile(currentSymbol, holdingPrice),
    [currentSymbol, holdingPrice]
  );
  const health = useMemo(
    () =>
      evaluateHealthFromVerifiedFinancials({
        symbol: currentSymbol,
        report: financialReport,
        periodType,
        marketCap: null,
        livePrice: holdingPrice,
      }),
    [currentSymbol, financialReport, periodType, holdingPrice]
  );
  const piotroski = health.piotroski;
  const altman = health.altman;
  const dupont = health.dupont;

  // Group Piotroski items by category
  const categories = useMemo(() => {
    const map: Record<string, typeof piotroski.items> = {};
    piotroski.items.forEach((item) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return map;
  }, [piotroski]);

  // Calculate Altman pointer percentage for spectrum bar (clamped 0 to 5)
  const altmanPointerPercent = useMemo(() => {
    const clamped = Math.max(0, Math.min(5, altman.zScore ?? 0));
    return (clamped / 5) * 100;
  }, [altman.zScore]);

  return (
    <div className="space-y-6">
      <QuantProfileBanner
        symbol={currentSymbol}
        meta={{
          ...profile.profileMeta,
          kind: health.isSourced ? 'sourced' : profile.profileMeta.kind,
        }}
      />
      {/* Analysis header and symbol selection */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-text-primary">
                Finansal Sağlık &amp; Bilanço Güvenlik Skorları
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Piotroski F-Score, Altman Z-Score ve DuPont ayrışımı — doğrulanmış finansal kalemler, dönemler ve eksik girdilerle
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl bg-bg-secondary border border-border p-1 text-xs">
              <button
                type="button"
                onClick={() => setPeriodType('annual')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  periodType === 'annual'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Yıllık
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('quarterly')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  periodType === 'quarterly'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Çeyreklik
              </button>
            </div>

            <QuantSymbolSelect
              value={currentSymbol}
              onChange={handleSelect}
              portfolioStocks={portfolioStocks}
              fallbackSymbols={Object.keys(PRESET_FINANCIAL_PROFILES)}
            />
          </div>
        </div>

        {isLoadingFinancials && (
          <p className="text-[11px] text-text-muted">
            Doğrulanmış finansal tablolar yükleniyor…
          </p>
        )}

        {/* If Active Holding is in user's portfolio, show portfolio context bar */}
        {activeHolding && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base"><UIIcon name="sparkles" className="w-4 h-4" /></span>
              <div>
                <span className="font-bold text-accent">{activeHolding.symbol}</span>
                <span className="text-text-secondary ml-1">portföyünüzde mevcut:</span>
                <span className="font-bold text-text-primary ml-1.5">{activeHolding.totalQuantity} Lot</span>
                <span className="text-text-muted mx-1.5">•</span>
                <span className="text-text-secondary">Ortalama Maliyetiniz:</span>
                <span className="font-bold text-text-primary ml-1">₺{activeHolding.averageCost.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-text-muted">Portföy K/Z:</span>
              <span
                className={`font-black px-2 py-0.5 rounded-md ${
                  activeHolding.pnlPercent >= 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                %{activeHolding.pnlPercent >= 0 ? '+' : ''}
                {activeHolding.pnlPercent.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Grid: 1. Piotroski F-Score (Full Card) */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shrink-0">
              <span className="text-xl font-black">{piotroski.score}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">
                  Piotroski F-Score (9 Kriterli Bilanço Testi)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase border ${
                    piotroski.score >= 8
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : piotroski.score >= 5
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  }`}
                >
                  {piotroski.verdict} ({piotroski.score} / {piotroski.maxScore})
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                8-9 Puan: Üstün Finansal Güç | 5-7 Puan: Dengeli | 0-4 Puan: Yüksek Risk / Kırılgan
              </p>
            </div>
          </div>
        </div>

        {/* 3 Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Object.entries(categories).map(([catName, items]) => {
            const passedCount = items.filter((i) => i.passed).length;
            return (
              <div
                key={catName}
                className="p-4 rounded-xl bg-bg-secondary/40 border border-border space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/80">
                  <span className="text-xs font-bold text-text-primary">{catName}</span>
                  <span className="text-[11px] font-bold text-accent">
                    {passedCount} / {items.length} Geçti
                  </span>
                </div>

                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-bg-card/70 border border-border/60 text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5">
                          {item.status === 'passed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : item.status === 'missing' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <span className="font-semibold text-text-primary leading-snug">
                            {item.title}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            item.status === 'passed'
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : item.status === 'missing'
                              ? 'text-amber-400 bg-amber-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          {item.value}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted pl-5 leading-tight">
                        {item.description}
                      </p>
                      <p className="text-[10px] text-text-muted/80 pl-5">
                        Dönem: {item.periodLabel}
                        {item.missingInputs.length > 0 && ` • Eksik: ${item.missingInputs.join(', ')}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <HealthProvenanceBox
          testId="piotroski-provenance"
          sourceName={piotroski.sourceName}
          isSourced={piotroski.isSourced}
          periodsUsed={piotroski.periodsUsed}
          usedItems={piotroski.usedItems}
          missingInputs={piotroski.missingInputs}
        />
      </div>

      {/* Grid: 2. Altman Z-Score & 3. DuPont Tree */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Altman Z-Score */}
        <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                <h3 className="text-sm sm:text-base font-bold text-text-primary">
                  Altman Z-Score (İflas Riski Ölçümü)
                </h3>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-text-primary">
                  {altman.zScore !== null ? altman.zScore.toFixed(2) : '—'}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{
                    backgroundColor: `${altman.color}15`,
                    color: altman.color,
                    border: `1px solid ${altman.color}30`,
                  }}
                >
                  {altman.zone}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted mt-3">
              {altman.interpretation}
            </p>

            {/* Spectrum Bar */}
            <div className="mt-5 space-y-2">
              <div className="relative h-4 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 p-0.5 overflow-visible">
                {/* Pointer marker */}
                <div
                  className="absolute -top-2 transform -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-500"
                  style={{ left: `${altmanPointerPercent}%` }}
                >
                  <div className="w-4 h-4 rounded-full bg-white border-2 border-accent shadow-md" />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-text-muted font-bold">
                <span className="text-rose-400">İflas Tehlikesi (&lt; 1.81)</span>
                <span className="text-amber-400">Gri Bölge (1.81 - 2.99)</span>
                <span className="text-emerald-400">Güvenli Bölge (&gt; 2.99)</span>
              </div>
            </div>

            {/* Components Table */}
            <div className="mt-5 space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-text-muted">
                5 Bileşen Ağırlık Dökümü:
              </span>
              <div className="divide-y divide-border/60 text-xs">
                {altman.components.map((c, idx) => (
                  <div
                    key={idx}
                    className="py-1.5 flex items-center justify-between text-text-secondary"
                  >
                    <div>
                      <span className="font-semibold text-text-primary">{c.label}</span>
                      <span className="text-[10px] text-text-muted ml-1.5 font-mono">
                        ({c.factor})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-accent">
                      {c.weighted !== null ? `+${c.weighted}` : 'Eksik'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <HealthProvenanceBox
            testId="altman-provenance"
            sourceName={altman.sourceName}
            isSourced={altman.isSourced}
            periodsUsed={altman.periodsUsed}
            usedItems={altman.usedItems}
            missingInputs={altman.missingInputs}
          />
        </div>

        {/* DuPont 3-Bileşenli ROE Ağacı */}
        <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" />
                <h3 className="text-sm sm:text-base font-bold text-text-primary">
                  DuPont 3 Bileşenli ROE Ağacı
                </h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-text-muted font-semibold">Toplam ROE:</span>
                <span className="text-xl font-black text-accent">
                  {dupont.roe !== null ? `%${dupont.roe.toFixed(1)}` : 'Eksik'}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted mt-2">
              Özkaynak kârlılığını Marj, Hız ve Kaldıraç olarak 3 çarpanına ayırarak büyümenin kaynağını şeffaflaştırır.
            </p>

            {/* Visual Formula Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 text-center">
              {/* 1. Margin */}
              <div className="p-3 rounded-xl bg-bg-secondary/60 border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase font-bold block">
                  1. Net Kâr Marjı
                </span>
                <span className="text-base sm:text-lg font-black text-text-primary block">
                  {dupont.netMargin !== null ? `%${dupont.netMargin.toFixed(1)}` : '—'}
                </span>
                <span className="text-[9px] text-text-muted block">
                  Kâr / Ciro
                </span>
              </div>

              {/* 2. Turnover */}
              <div className="p-3 rounded-xl bg-bg-secondary/60 border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase font-bold block">
                  2. Aktif Devir Hızı
                </span>
                <span className="text-base sm:text-lg font-black text-text-primary block">
                  {dupont.assetTurnover !== null ? `${dupont.assetTurnover.toFixed(2)}x` : '—'}
                </span>
                <span className="text-[9px] text-text-muted block">
                  Ciro / Aktifler
                </span>
              </div>

              {/* 3. Leverage */}
              <div className="p-3 rounded-xl bg-bg-secondary/60 border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase font-bold block">
                  3. Borç Kaldıracı
                </span>
                <span className="text-base sm:text-lg font-black text-text-primary block">
                  {dupont.financialLeverage !== null
                    ? `${dupont.financialLeverage.toFixed(2)}x`
                    : '—'}
                </span>
                <span className="text-[9px] text-text-muted block">
                  Aktifler / Özkaynak
                </span>
              </div>
            </div>

            {/* Formula Line */}
            <div className="mt-4 p-3 rounded-xl bg-bg-secondary/30 border border-border text-center text-xs font-mono text-text-secondary">
              <span className="font-bold text-text-primary">
                ROE ({dupont.roe !== null ? `%${dupont.roe}` : '—'})
              </span>{' '}
              ={' '}
              <span className="text-emerald-400 font-bold">
                {dupont.netMargin !== null ? `%${dupont.netMargin}` : '—'}
              </span>{' '}
              ×{' '}
              <span className="text-blue-400 font-bold">
                {dupont.assetTurnover !== null ? `${dupont.assetTurnover}x` : '—'}
              </span>{' '}
              ×{' '}
              <span className="text-amber-400 font-bold">
                {dupont.financialLeverage !== null ? `${dupont.financialLeverage}x` : '—'}
              </span>
            </div>

            {/* Quality of Earnings Insight */}
            <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-xs text-text-primary">
              <div className="flex items-center gap-1.5 font-bold text-accent mb-1">
                <Info className="w-3.5 h-3.5" />
                <span>Kârlılık Kalitesi Yorumu:</span>
              </div>
              <p className="leading-relaxed text-text-secondary">
                {dupont.verdict}
              </p>
            </div>
          </div>

          <HealthProvenanceBox
            testId="dupont-provenance"
            sourceName={dupont.sourceName}
            isSourced={dupont.isSourced}
            periodsUsed={dupont.periodsUsed}
            usedItems={dupont.usedItems}
            missingInputs={dupont.missingInputs}
          />
        </div>
      </div>
    </div>
  );
}
