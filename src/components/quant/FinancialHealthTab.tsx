'use client';

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
  evaluatePiotroski,
  evaluateAltmanZ,
  evaluateDuPont,
  PRESET_FINANCIAL_PROFILES,
} from '@/lib/quant/models';
import { Holding } from '@/types/portfolio';

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

  const handleSelect = (sym: string) => {
    const cleanSym = sym.trim().toUpperCase();
    setCurrentSymbol(cleanSym);
    onSelectSymbol?.(cleanSym);
  };

  const piotroski = useMemo(
    () => evaluatePiotroski(currentSymbol, activeHolding?.currentPrice),
    [currentSymbol, activeHolding?.currentPrice]
  );
  const altman = useMemo(
    () => evaluateAltmanZ(currentSymbol, activeHolding?.currentPrice),
    [currentSymbol, activeHolding?.currentPrice]
  );
  const dupont = useMemo(
    () => evaluateDuPont(currentSymbol, activeHolding?.currentPrice),
    [currentSymbol, activeHolding?.currentPrice]
  );

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
    const clamped = Math.max(0, Math.min(5, altman.zScore));
    return (clamped / 5) * 100;
  }, [altman.zScore]);

  return (
    <div className="space-y-6">
      {/* Top Controls: Preset Chips with Portfolio Priority */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-text-primary">
                Finansal Sağlık & Bilanço Güvenlik Skorları
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Stanford Üniversitesi (Piotroski F-Score), NYU Stern (Altman Z-Score) ve DuPont kârlılık ayrışımı ile şirketin iflas ve manipülasyon riskini test edin.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
            <span className="text-xs font-bold text-accent uppercase tracking-wider mr-1 shrink-0">
              {portfolioStocks.length > 0 ? '💼 Portföy Hisseleriniz:' : 'Şirket:'}
            </span>

            {portfolioStocks.length > 0
              ? portfolioStocks.map((h) => {
                  const isSelected = currentSymbol.toUpperCase() === h.symbol.toUpperCase();
                  return (
                    <button
                      key={h.symbol}
                      onClick={() => handleSelect(h.symbol)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isSelected
                          ? 'bg-accent text-white shadow-md shadow-accent/25 ring-2 ring-accent/30'
                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary border border-border'
                      }`}
                    >
                      <span>{h.symbol}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-bg-tertiary text-text-muted'
                        }`}
                      >
                        %{h.weight.toFixed(1)}
                      </span>
                    </button>
                  );
                })
              : Object.keys(PRESET_FINANCIAL_PROFILES).map((sym) => {
                  const isSelected = currentSymbol === sym;
                  return (
                    <button
                      key={sym}
                      onClick={() => handleSelect(sym)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary border border-border'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* If Active Holding is in user's portfolio, show portfolio context bar */}
        {activeHolding && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">💼</span>
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
                          {item.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <span className="font-semibold text-text-primary leading-snug">
                            {item.title}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            item.passed
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          {item.value}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted pl-5 leading-tight">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
                  {altman.zScore.toFixed(2)}
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
                      +{c.weighted}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                  %{dupont.roe.toFixed(1)}
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
                  %{dupont.netMargin.toFixed(1)}
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
                  {dupont.assetTurnover.toFixed(2)}x
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
                  {dupont.financialLeverage.toFixed(2)}x
                </span>
                <span className="text-[9px] text-text-muted block">
                  Aktifler / Özkaynak
                </span>
              </div>
            </div>

            {/* Formula Line */}
            <div className="mt-4 p-3 rounded-xl bg-bg-secondary/30 border border-border text-center text-xs font-mono text-text-secondary">
              <span className="font-bold text-text-primary">ROE (%{dupont.roe})</span> ={' '}
              <span className="text-emerald-400 font-bold">%{dupont.netMargin}</span> ×{' '}
              <span className="text-blue-400 font-bold">{dupont.assetTurnover}x</span> ×{' '}
              <span className="text-amber-400 font-bold">{dupont.financialLeverage}x</span>
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
        </div>
      </div>
    </div>
  );
}
