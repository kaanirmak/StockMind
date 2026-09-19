'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Flame,
  Shuffle,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
  Activity,
  Layers,
} from '@/components/quant/QuantIcons';
import {
  runMonteCarloSimulation,
  getFinancialProfile,
  PRESET_FINANCIAL_PROFILES,
} from '@/lib/quant/models';
import { Holding } from '@/types/portfolio';

interface StressTestTabProps {
  selectedSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
  portfolioStocks?: Holding[];
}

export default function StressTestTab({
  selectedSymbol,
  onSelectSymbol,
  portfolioStocks = [],
}: StressTestTabProps) {
  const initialSym = selectedSymbol || portfolioStocks[0]?.symbol || 'THYAO';
  const [currentSymbol, setCurrentSymbol] = useState<string>(initialSym);
  const [volatility, setVolatility] = useState<number>(32); // %32
  const [drift, setDrift] = useState<number>(24); // %24
  const [seed, setSeed] = useState<number>(0);

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

  const preset = useMemo(() => {
    return getFinancialProfile(currentSymbol, activeHolding?.currentPrice);
  }, [currentSymbol, activeHolding?.currentPrice]);

  const currentPrice = activeHolding?.currentPrice || preset.currentPrice;

  // Run simulation
  const mcResult = useMemo(() => {
    return runMonteCarloSimulation(currentPrice, volatility / 100, drift / 100);
  }, [currentPrice, volatility, drift, seed]);

  // SVG Chart Dimensions & Scaling
  const chartWidth = 700;
  const chartHeight = 260;
  const padding = { top: 20, right: 60, bottom: 30, left: 50 };

  const allPoints = mcResult.sampleTrajectories.flat();
  const minVal = Math.min(...allPoints, mcResult.var5Percentile * 0.95);
  const maxVal = Math.max(...allPoints, mcResult.best95Percentile * 1.05);

  const scaleX = (idx: number, total: number) => {
    return (
      padding.left +
      (idx / (total - 1)) * (chartWidth - padding.left - padding.right)
    );
  };

  const scaleY = (val: number) => {
    return (
      chartHeight -
      padding.bottom -
      ((val - minVal) / Math.max(1, maxVal - minVal)) *
        (chartHeight - padding.top - padding.bottom)
    );
  };

  const trajectoryColors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
  ];

  return (
    <div className="space-y-6">
      {/* Top Controls: Preset Chips with Portfolio Priority */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Shuffle className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-text-primary">
                Monte Carlo Simülatörü & Makro Kriz Stres Testi
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-1">
              10.000 İstatistiki simülasyon (Geometrik Brownian Hareketi) ile 1 yıllık olasılık dağılımını ve makroekonomik kriz şoklarına karşı direnci test edin.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSeed((s) => s + 1)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-accent" />
              <span>Yeniden Simüle Et</span>
            </button>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-xs font-bold text-accent uppercase tracking-wider mr-1 shrink-0">
                {portfolioStocks.length > 0 ? '💼 Portföy:' : 'Şirket:'}
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
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
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
        </div>

        {/* If Active Holding is in user's portfolio, show portfolio lot value projection */}
        {activeHolding && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">💼</span>
              <div>
                <span className="font-bold text-accent">{activeHolding.symbol}</span>
                <span className="text-text-secondary ml-1">portföyünüzde:</span>
                <span className="font-bold text-text-primary ml-1.5">{activeHolding.totalQuantity} Lot</span>
                <span className="text-text-muted mx-1.5">•</span>
                <span className="text-text-secondary">Pozisyon Tutarı:</span>
                <span className="font-bold text-text-primary ml-1">₺{(activeHolding.currentValue || (currentPrice * activeHolding.totalQuantity)).toLocaleString('tr-TR')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1 text-rose-400">
                <span className="text-text-muted">1 Yıl En Kötü (%5):</span>
                <span className="font-bold">₺{(mcResult.var5Percentile * activeHolding.totalQuantity).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="text-text-muted">1 Yıl Medyan:</span>
                <span className="font-bold">₺{(mcResult.medianPrice * activeHolding.totalQuantity).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hero Stat Cards: VaR 95%, Median, Best Case */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Worst 5% Case (VaR) */}
        <div className="glass-card p-5 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              %5 En Kötü Senaryo (VaR 95)
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-text-primary">
              ₺{mcResult.var5Percentile.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-rose-400">
              (%{(((mcResult.var5Percentile - currentPrice) / currentPrice) * 100).toFixed(1)})
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            10.000 koşunun en olumsuz %5&apos;lik dilimindeki alt taban fiyat seviyesi (Stop-loss referansı).
          </p>
        </div>

        {/* Median 50% Case */}
        <div className="glass-card p-5 rounded-2xl border border-accent/30 bg-accent/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              %50 Medyan Beklenen Fiyat
            </span>
            <TrendingUp className="w-4 h-4 text-accent" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-text-primary">
              ₺{mcResult.medianPrice.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-emerald-400">
              (+%{(((mcResult.medianPrice - currentPrice) / currentPrice) * 100).toFixed(1)})
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            Mevcut drift trendi ve oynaklık varsayımı ile 1 yıl sonrasındaki medyan olasılık noktası.
          </p>
        </div>

        {/* Best 95% Case */}
        <div className="glass-card p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              %95 En İyi Senaryo (Boğa)
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-text-primary">
              ₺{mcResult.best95Percentile.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-emerald-400">
              (+%{(((mcResult.best95Percentile - currentPrice) / currentPrice) * 100).toFixed(1)})
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            Piyasanın güçlü momentum yakaladığı boğa koşullarındaki üst hedef tavan seviyesi.
          </p>
        </div>
      </div>

      {/* Interactive Simulation Sliders */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Volatility Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary">
                Yıllık Volatilite (Oynaklık / σ): <span className="text-accent">%{volatility}</span>
              </label>
              <span className="text-[11px] text-text-muted">Standart Sapma</span>
            </div>
            <input
              type="range"
              min="15"
              max="60"
              step="1"
              value={volatility}
              onChange={(e) => setVolatility(parseInt(e.target.value))}
              className="w-full accent-accent h-2 bg-bg-input rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>%15 (Defansif)</span>
              <span>%35 (Ortalama BIST)</span>
              <span>%60 (Yüksek Oynaklık)</span>
            </div>
          </div>

          {/* Drift Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary">
                Yıllık Getiri Beklentisi (Drift / μ): <span className="text-accent">%{drift}</span>
              </label>
              <span className="text-[11px] text-text-muted">Trend Eğilimi</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="1"
              value={drift}
              onChange={(e) => setDrift(parseInt(e.target.value))}
              className="w-full accent-accent h-2 bg-bg-input rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>%10 (Düşük Trend)</span>
              <span>%30 (Enflasyon Üstü)</span>
              <span>%50 (Güçlü Büyüme)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Trajectory Chart */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              1 Yıllık Olasılıksal Fiyat Patikaları (10.000 Simülasyondan Örnek 5 Yol)
            </h3>
          </div>
          <span className="text-xs text-text-muted font-mono font-medium">
            Başlangıç: ₺{currentPrice.toFixed(2)}
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto max-h-[300px] select-none"
          >
            <defs>
              <linearGradient id="corridorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.15" />
              </linearGradient>
            </defs>

            {/* Background Grid Lines */}
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = padding.top + ratio * (chartHeight - padding.top - padding.bottom);
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-border/40"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Baseline Initial Price Line */}
            <line
              x1={padding.left}
              y1={scaleY(currentPrice)}
              x2={chartWidth - padding.right}
              y2={scaleY(currentPrice)}
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <text
              x={chartWidth - padding.right + 5}
              y={scaleY(currentPrice) + 4}
              fontSize="10"
              fill="#94a3b8"
              fontWeight="bold"
            >
              ₺{currentPrice.toFixed(0)}
            </text>

            {/* 5 Trajectory Curves */}
            {mcResult.sampleTrajectories.map((trajectory, trajIdx) => {
              const points = trajectory
                .map((pt, ptIdx) => `${scaleX(ptIdx, trajectory.length)},${scaleY(pt)}`)
                .join(' ');

              const lastPoint = trajectory[trajectory.length - 1];

              return (
                <g key={trajIdx}>
                  <polyline
                    fill="none"
                    stroke={trajectoryColors[trajIdx % trajectoryColors.length]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    opacity="0.85"
                  />
                  {/* End node */}
                  <circle
                    cx={scaleX(trajectory.length - 1, trajectory.length)}
                    cy={scaleY(lastPoint)}
                    r="3.5"
                    fill={trajectoryColors[trajIdx % trajectoryColors.length]}
                  />
                </g>
              );
            })}

            {/* Axis Labels */}
            <text
              x={padding.left}
              y={chartHeight - 8}
              fontSize="10"
              fill="#94a3b8"
            >
              Bugün (Gün 0)
            </text>
            <text
              x={chartWidth / 2}
              y={chartHeight - 8}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              6. Ay (126 Gün)
            </text>
            <text
              x={chartWidth - padding.right}
              y={chartHeight - 8}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="end"
            >
              1. Yıl (252 Gün)
            </text>
          </svg>
        </div>
      </div>

      {/* Macro Crisis Stress Test Cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-accent" />
          <h3 className="text-base font-bold text-text-primary">
            Makroekonomik Kriz Stres Testleri
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {mcResult.stressTests.map((st, idx) => (
            <div
              key={idx}
              className="glass-card p-5 rounded-2xl border border-border space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-text-primary leading-tight">
                    {st.name}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-black shrink-0 ${
                      st.impactPercent > 0
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {st.impactPercent > 0 ? `+${st.impactPercent}%` : `${st.impactPercent}%`}
                  </span>
                </div>

                <p className="text-[11px] font-semibold text-text-muted">
                  Senaryo: {st.scenario}
                </p>

                <p className="text-xs text-text-secondary leading-relaxed pt-1 border-t border-border">
                  {st.notes}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-bg-secondary/60 border border-border text-[11px] text-text-muted">
                <strong>Korunma Stratejisi:</strong>{' '}
                {st.impactPercent < 0
                  ? 'Vadeli piyasalarda (VİOP) kısa pozisyon veya nakit ağırlığı artırımı önerilir.'
                  : 'Döviz pozisyonu korunarak getiri potansiyeli maksimize edilebilir.'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
