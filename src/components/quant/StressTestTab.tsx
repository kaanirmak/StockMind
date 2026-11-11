'use client';
import QuantSymbolSelect from './QuantSymbolSelect';
import QuantProfileBanner from './QuantProfileBanner';
import { Icon as UIIcon } from '@/components/ui/Icon';

import { palette } from '@/theme/palette';


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
  DEFAULT_STRESS_SHOCKS,
  MONTE_CARLO_SIMULATIONS,
  runMonteCarloSimulation,
  getFinancialProfile,
  getQuantCurrency,
  PRESET_FINANCIAL_PROFILES,
} from '@/lib/quant/models';
import {
  listMonteCarloScenarios,
  saveMonteCarloScenario,
  deleteMonteCarloScenario,
  type SavedMonteCarloScenario,
} from '@/lib/quant/monteCarloScenarios';
import {
  calculatePortfolioStressTest,
  type PortfolioShockMode,
} from '@/lib/quant/portfolioStress';
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
  const [timeHorizonDays, setTimeHorizonDays] = useState<number>(252);
  const [simulationsCount, setSimulationsCount] = useState<number>(MONTE_CARLO_SIMULATIONS);
  const [seed, setSeed] = useState<number>(42);
  const [savedScenarios, setSavedScenarios] = useState<SavedMonteCarloScenario[]>([]);
  const [fxShockPercent, setFxShockPercent] = useState<number>(DEFAULT_STRESS_SHOCKS.fxShockPercent);
  const [rateShockBps, setRateShockBps] = useState<number>(DEFAULT_STRESS_SHOCKS.rateShockBps);
  const [demandShockPercent, setDemandShockPercent] = useState<number>(DEFAULT_STRESS_SHOCKS.demandShockPercent);
  const [portfolioShockMode, setPortfolioShockMode] = useState<PortfolioShockMode>('combined');
  const [portfolioMarketShockPercent, setPortfolioMarketShockPercent] = useState<number>(-15);
  const [fxExposureInput, setFxExposureInput] = useState<string>('');
  const [demandBetaInput, setDemandBetaInput] = useState<string>('');

  useEffect(() => {
    setSavedScenarios(listMonteCarloScenarios());
  }, []);

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

  const nativeCurrency = getQuantCurrency(currentSymbol, activeHolding?.originalCurrency);
  const currencySign = nativeCurrency === 'USD' ? '$' : '₺';
  const holdingPrice = activeHolding?.originalPrice ?? activeHolding?.currentPrice;
  const profile = useMemo(
    () => getFinancialProfile(currentSymbol, holdingPrice),
    [currentSymbol, holdingPrice]
  );
  const currentPrice = profile.currentPrice;

  const parsedFxExposure = useMemo(() => {
    const num = Number(fxExposureInput.replace(',', '.'));
    return fxExposureInput.trim() !== '' && Number.isFinite(num) ? num / 100 : null;
  }, [fxExposureInput]);

  const parsedDemandBeta = useMemo(() => {
    const num = Number(demandBetaInput.replace(',', '.'));
    return demandBetaInput.trim() !== '' && Number.isFinite(num) ? num : null;
  }, [demandBetaInput]);

  // Run deterministic seeded simulation
  const mcResult = useMemo(() => {
    return runMonteCarloSimulation(
      currentPrice,
      volatility / 100,
      drift / 100,
      simulationsCount,
      {
        symbol: currentSymbol,
        livePrice: holdingPrice,
        profile,
        timeHorizonDays,
        seed,
        shocks: {
          fxShockPercent,
          rateShockBps,
          demandShockPercent,
        },
        sensitivities: {
          fxExposureRatio: parsedFxExposure,
          demandBeta: parsedDemandBeta,
        },
      }
    );
  }, [
    currentPrice,
    volatility,
    drift,
    simulationsCount,
    timeHorizonDays,
    seed,
    currentSymbol,
    holdingPrice,
    profile,
    fxShockPercent,
    rateShockBps,
    demandShockPercent,
    parsedFxExposure,
    parsedDemandBeta,
  ]);

  const portfolioStress = useMemo(
    () =>
      calculatePortfolioStressTest({
        holdings: portfolioStocks,
        mode: portfolioShockMode,
        fxShockPercent,
        rateShockBps,
        marketShockPercent: portfolioMarketShockPercent,
      }),
    [portfolioStocks, portfolioShockMode, fxShockPercent, rateShockBps, portfolioMarketShockPercent]
  );

  const handleSaveScenario = () => {
    const next = saveMonteCarloScenario({
      symbol: currentSymbol,
      initialPrice: currentPrice,
      currency: nativeCurrency,
      timeHorizonDays: mcResult.timeHorizonDays,
      volatilityPercent: volatility,
      driftPercent: drift,
      simulationsCount: mcResult.simulationsCount,
      seed: mcResult.seed,
      medianPrice: mcResult.medianPrice,
      var5Percentile: mcResult.var5Percentile,
      best95Percentile: mcResult.best95Percentile,
    });
    setSavedScenarios(next);
  };

  const handleLoadScenario = (scenario: SavedMonteCarloScenario) => {
    handleSelect(scenario.symbol);
    setTimeHorizonDays(scenario.timeHorizonDays);
    setVolatility(scenario.volatilityPercent);
    setDrift(scenario.driftPercent);
    setSimulationsCount(scenario.simulationsCount);
    setSeed(scenario.seed);
  };

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
    palette.info, // blue
    palette.success, // emerald
    palette.warning, // amber
    palette.primaryDark, // violet
    palette.color06b6d4, // cyan
  ];

  return (
    <div className="space-y-6">
      <QuantProfileBanner symbol={currentSymbol} meta={profile.profileMeta} />
      {/* Analysis header and symbol selection */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Shuffle className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-text-primary">
                Monte Carlo Simülatörü &amp; Makro Kriz Stres Testi
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-1">
              {mcResult.simulationsCount.toLocaleString('tr-TR')} koşu • {mcResult.timeHorizonDays} iş günü vade • Tohum (Seed):{' '}
              <span className="font-mono font-bold text-accent">{mcResult.seed}</span> — aynı girdiler her zaman aynı sonucu üretir.
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              data-testid="mc-save-scenario-btn"
              onClick={handleSaveScenario}
              className="min-h-11 justify-center px-3 py-2 rounded-xl text-xs font-semibold bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Senaryoyu Kaydet</span>
            </button>
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="min-h-11 justify-center px-3 py-2 rounded-xl text-xs font-semibold bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-accent" />
              <span>Yeni Tohum (#{seed + 1})</span>
            </button>

            <QuantSymbolSelect
              value={currentSymbol}
              onChange={handleSelect}
              portfolioStocks={portfolioStocks}
              fallbackSymbols={Object.keys(PRESET_FINANCIAL_PROFILES)}
            />
          </div>
        </div>

        {/* If Active Holding is in user's portfolio, show portfolio lot value projection */}
        {activeHolding && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base"><UIIcon name="sparkles" className="w-4 h-4" /></span>
              <div>
                <span className="font-bold text-accent">{activeHolding.symbol}</span>
                <span className="text-text-secondary ml-1">portföyünüzde:</span>
                <span className="font-bold text-text-primary ml-1.5">{activeHolding.totalQuantity} Lot</span>
                <span className="text-text-muted mx-1.5">•</span>
                <span className="text-text-secondary">Pozisyon Tutarı:</span>
                <span className="font-bold text-text-primary ml-1">{currencySign}{(currentPrice * activeHolding.totalQuantity).toLocaleString('tr-TR')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1 text-rose-400">
                <span className="text-text-muted">1 Yıl En Kötü (%5):</span>
                <span className="font-bold">{currencySign}{(mcResult.var5Percentile * activeHolding.totalQuantity).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="text-text-muted">1 Yıl Medyan:</span>
                <span className="font-bold">{currencySign}{(mcResult.medianPrice * activeHolding.totalQuantity).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
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
              {currencySign}{mcResult.var5Percentile.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-rose-400">
              (%{(((mcResult.var5Percentile - currentPrice) / currentPrice) * 100).toFixed(1)})
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            {mcResult.simulationsCount.toLocaleString('tr-TR')} koşunun en olumsuz %5&apos;lik dilimindeki alt taban fiyat seviyesi (Stop-loss referansı).
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
              {currencySign}{mcResult.medianPrice.toFixed(2)}
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
              {currencySign}{mcResult.best95Percentile.toFixed(2)}
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

      {/* Interactive Simulation Controls & Reproducibility */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border space-y-4">
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
              onChange={(e) => setVolatility(parseInt(e.target.value, 10))}
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
              onChange={(e) => setDrift(parseInt(e.target.value, 10))}
              className="w-full accent-accent h-2 bg-bg-input rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>%10 (Düşük Trend)</span>
              <span>%30 (Enflasyon Üstü)</span>
              <span>%50 (Güçlü Büyüme)</span>
            </div>
          </div>
        </div>

        {/* Horizon, Simulations Count & Reproducible Seed */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border/60 text-xs">
          <div className="space-y-1">
            <label htmlFor="mc-horizon-days" className="block font-bold text-text-secondary">
              Vade (İş Günü)
            </label>
            <select
              id="mc-horizon-days"
              value={timeHorizonDays}
              onChange={(e) => setTimeHorizonDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-bg-input border border-border text-text-primary font-mono text-xs"
            >
              <option value={63}>63 İş Günü (~3 Ay)</option>
              <option value={126}>126 İş Günü (~6 Ay)</option>
              <option value={252}>252 İş Günü (1 Yıl)</option>
              <option value={504}>504 İş Günü (2 Yıl)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="mc-runs-count" className="block font-bold text-text-secondary">
              Koşu Sayısı
            </label>
            <select
              id="mc-runs-count"
              value={simulationsCount}
              onChange={(e) => setSimulationsCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-bg-input border border-border text-text-primary font-mono text-xs"
            >
              <option value={1000}>1.000 Koşu</option>
              <option value={2500}>2.500 Koşu</option>
              <option value={5000}>5.000 Koşu</option>
              <option value={10000}>10.000 Koşu</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="mc-seed-input" className="block font-bold text-text-secondary">
              Rastgelelik Tohumu (Seed)
            </label>
            <input
              id="mc-seed-input"
              type="number"
              min={1}
              step={1}
              value={seed}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (Number.isFinite(val)) setSeed(Math.max(1, Math.trunc(val)));
              }}
              className="w-full px-3 py-2 rounded-xl bg-bg-input border border-border text-text-primary font-mono text-xs"
            />
          </div>
        </div>

        {savedScenarios.length > 0 && (
          <div data-testid="mc-saved-scenarios" className="pt-3 border-t border-border/60 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
              Kaydedilen Tekrarlanabilir Senaryolar ({savedScenarios.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {savedScenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-bg-secondary border border-border text-[11px]"
                >
                  <button
                    type="button"
                    onClick={() => handleLoadScenario(sc)}
                    className="font-semibold text-text-primary hover:text-accent cursor-pointer text-left"
                  >
                    {sc.label} → Medyan:{' '}
                    <span className="font-mono font-bold text-accent">
                      {sc.currency === 'USD' ? '$' : '₺'}
                      {sc.medianPrice.toFixed(2)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${sc.label} senaryosunu sil`}
                    onClick={() => setSavedScenarios(deleteMonteCarloScenario(sc.id))}
                    className="text-text-muted hover:text-rose-400 px-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SVG Trajectory Chart */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              {mcResult.timeHorizonDays} İş Günlük Olasılıksal Fiyat Patikaları ({mcResult.simulationsCount.toLocaleString('tr-TR')} Koşu • Tohum #{mcResult.seed})
            </h3>
          </div>
          <span className="text-xs text-text-muted font-mono font-medium">
            Başlangıç: {currencySign}{currentPrice.toFixed(2)}
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto max-h-[300px] select-none"
          >
            <defs>
              <linearGradient id="corridorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.success} stopOpacity="0.15" />
                <stop offset="100%" stopColor={palette.danger} stopOpacity="0.15" />
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
              stroke={palette.color64748b}
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <text
              x={chartWidth - padding.right + 5}
              y={scaleY(currentPrice) + 4}
              fontSize="10"
              fill={palette.color94a3b8}
              fontWeight="bold"
            >
              {currencySign}{currentPrice.toFixed(0)}
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
              fill={palette.color94a3b8}
            >
              Bugün (Gün 0)
            </text>
            <text
              x={chartWidth / 2}
              y={chartHeight - 8}
              fontSize="10"
              fill={palette.color94a3b8}
              textAnchor="middle"
            >
              6. Ay (126 Gün)
            </text>
            <text
              x={chartWidth - padding.right}
              y={chartHeight - 8}
              fontSize="10"
              fill={palette.color94a3b8}
              textAnchor="end"
            >
              1. Yıl (252 Gün)
            </text>
          </svg>
        </div>
      </div>

      {/* Macro Crisis Stress Test Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-text-primary">
              Makroekonomik Kriz Stres Testleri
            </h3>
          </div>
          <span className="text-[11px] text-text-muted">
            Her senaryo seçilen şok değerleri ve açık varsayımlarla hesaplanır
          </span>
        </div>

        {/* Shock Parameters & Explicit Sensitivity Inputs */}
        <div className="glass-card p-4 rounded-2xl border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="stress-fx-shock" className="block text-[11px] font-bold text-text-secondary">
              Kur Şoku (USD/TRY %)
            </label>
            <input
              id="stress-fx-shock"
              type="number"
              min={-50}
              max={100}
              step={5}
              value={fxShockPercent}
              onChange={(e) => setFxShockPercent(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-xl bg-bg-input border border-border text-xs font-semibold text-text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="stress-rate-shock" className="block text-[11px] font-bold text-text-secondary">
              Faiz Şoku (bps)
            </label>
            <input
              id="stress-rate-shock"
              type="number"
              min={-1500}
              max={2500}
              step={100}
              value={rateShockBps}
              onChange={(e) => setRateShockBps(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-xl bg-bg-input border border-border text-xs font-semibold text-text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="stress-demand-shock" className="block text-[11px] font-bold text-text-secondary">
              Talep Şoku (%)
            </label>
            <input
              id="stress-demand-shock"
              type="number"
              min={-60}
              max={40}
              step={5}
              value={demandShockPercent}
              onChange={(e) => setDemandShockPercent(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-xl bg-bg-input border border-border text-xs font-semibold text-text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="stress-fx-exposure" className="block text-[11px] font-bold text-text-secondary">
              Döviz Gelir Payı (%, Opsiyonel)
            </label>
            <input
              id="stress-fx-exposure"
              type="number"
              min={-100}
              max={150}
              step={5}
              placeholder="Örnek varsayım"
              value={fxExposureInput}
              onChange={(e) => setFxExposureInput(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-bg-input border border-border text-xs font-semibold text-text-primary placeholder:text-text-muted"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="stress-demand-beta" className="block text-[11px] font-bold text-text-secondary">
              Talep Betası (x, Opsiyonel)
            </label>
            <input
              id="stress-demand-beta"
              type="number"
              min={-1}
              max={2.5}
              step={0.1}
              placeholder="Örnek varsayım"
              value={demandBetaInput}
              onChange={(e) => setDemandBetaInput(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-bg-input border border-border text-xs font-semibold text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {mcResult.stressTests.map((st) => (
            <div
              key={st.id}
              data-testid={`stress-card-${st.id}`}
              className="glass-card p-5 rounded-2xl border border-border space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-text-primary leading-tight">
                      {st.name}
                    </h4>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        st.isExampleScenario
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {st.isExampleScenario
                        ? 'Örnek Senaryo (Eksik Girdi Varsayımı)'
                        : 'Açık Girdiyle Hesaplandı'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-black shrink-0 ${
                      st.impactPercent > 0
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : st.impactPercent < 0
                          ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                          : 'bg-bg-secondary border border-border text-text-secondary'
                    }`}
                  >
                    {st.impactPercent > 0 ? `+${st.impactPercent}%` : `${st.impactPercent}%`}
                  </span>
                </div>

                <p className="text-[11px] font-semibold text-text-muted">
                  Senaryo: {st.scenario}
                </p>

                <ul className="space-y-1 rounded-xl bg-bg-secondary/50 border border-border/70 p-2.5 text-[11px] text-text-secondary">
                  {st.assumptions.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>

                <p className="text-xs text-text-secondary leading-relaxed pt-1 border-t border-border">
                  {st.notes}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-bg-secondary/60 border border-border text-[11px] text-text-muted">
                <strong>Değerlendirme Notu:</strong>{' '}
                {st.impactPercent < 0
                  ? 'Olumsuz şok etkisine karşı nakit tamponu veya kur/faiz riskinden korunma değerlendirilebilir.'
                  : st.impactPercent > 0
                    ? 'Tanımlanan şok yönü mevcut duyarlılık varsayımlarına göre pozitif etki üretiyor.'
                    : 'Mevcut şok ve duyarlılık girdileri nötr net etki üretiyor.'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio-Wide Stress Test (QNT-10) */}
      <div
        data-testid="portfolio-stress-section"
        className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              Portföy Bazında Stres Testi &amp; Pozisyon Katkıları
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Seçilen kur, faiz veya piyasa şokunu aktif portföy pozisyonlarınıza uygular; her pozisyonun TL ve puan katkısını açıklar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(
              [
                ['combined', 'Birleşik Şok'],
                ['fx', 'Kur Şoku'],
                ['rate', 'Faiz Şoku'],
                ['market', 'Piyasa Şoku'],
              ] as const
            ).map(([modeId, modeLabel]) => (
              <button
                key={modeId}
                type="button"
                data-testid={`portfolio-stress-mode-${modeId}`}
                onClick={() => setPortfolioShockMode(modeId)}
                className={`px-3 py-1.5 rounded-xl font-bold border transition-colors cursor-pointer ${
                  portfolioShockMode === modeId
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg-secondary text-text-secondary border-border hover:text-text-primary'
                }`}
              >
                {modeLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-bg-secondary/50 border border-border space-y-1">
            <label htmlFor="portfolio-market-shock" className="block text-[11px] font-bold text-text-secondary">
              Piyasa / Endeks Şoku (%)
            </label>
            <input
              id="portfolio-market-shock"
              type="number"
              min={-60}
              max={60}
              step={1}
              value={portfolioMarketShockPercent}
              onChange={(e) => setPortfolioMarketShockPercent(Number(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-xl bg-bg-input border border-border font-mono font-bold text-text-primary"
            />
          </div>

          <div className="p-3 rounded-xl bg-bg-secondary/50 border border-border">
            <span className="text-[11px] text-text-muted block">Mevcut Portföy Değeri</span>
            <span className="text-base font-black text-text-primary font-mono">
              ₺{portfolioStress.totalCurrentValueTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-bg-secondary/50 border border-border">
            <span className="text-[11px] text-text-muted block">Stres Sonrası Değer</span>
            <span className="text-base font-black text-text-primary font-mono">
              ₺{portfolioStress.totalStressedValueTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-bg-secondary/50 border border-border">
            <span className="text-[11px] text-text-muted block">Net Portföy Etkisi</span>
            <span
              className={`text-base font-black font-mono ${
                portfolioStress.totalImpactTry >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {portfolioStress.totalImpactTry >= 0 ? '+' : ''}
              ₺{portfolioStress.totalImpactTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} (
              {portfolioStress.totalImpactPercent >= 0 ? '+' : ''}
              {portfolioStress.totalImpactPercent}%)
            </span>
          </div>
        </div>

        <ul
          data-testid="portfolio-stress-assumptions"
          className="rounded-xl bg-bg-secondary/40 border border-border/80 p-3 space-y-1 text-[11px] text-text-secondary"
        >
          <li className="font-bold text-text-primary uppercase text-[10px] tracking-wider">
            Uygulanan Şoklar &amp; Portföy Varsayımları
          </li>
          {portfolioStress.portfolioAssumptions.map((item, idx) => (
            <li key={idx}>• {item}</li>
          ))}
        </ul>

        {portfolioStress.positions.length === 0 ? (
          <div className="p-4 rounded-xl bg-bg-secondary/40 border border-border text-xs text-text-muted">
            Portföy stres katkısı hesaplanabilmesi için portföyünüzde fiyatı doğrulanmış en az bir pozisyon bulunmalıdır.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted text-[11px]">
                  <th className="py-2 px-2">Pozisyon</th>
                  <th className="py-2 px-2 text-right">Ağırlık</th>
                  <th className="py-2 px-2 text-right">Şok Etkisi</th>
                  <th className="py-2 px-2 text-right">Portföye Katkı</th>
                  <th className="py-2 px-2 text-right">Stres Sonrası Değer</th>
                  <th className="py-2 px-2">Varsayımlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {portfolioStress.positions.map((pos) => (
                  <tr key={pos.symbol} data-testid={`portfolio-stress-row-${pos.symbol}`}>
                    <td className="py-2.5 px-2 font-bold text-text-primary">
                      {pos.symbol}{' '}
                      <span className="text-[10px] font-normal text-text-muted">
                        ({pos.exchange} • {pos.currency})
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-text-secondary">
                      %{pos.weightPercent.toFixed(1)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono font-bold ${
                        pos.shockImpactPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pos.shockImpactPercent >= 0 ? '+' : ''}
                      {pos.shockImpactPercent.toFixed(2)}%
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono font-bold ${
                        pos.contributionTry >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pos.contributionTry >= 0 ? '+' : ''}
                      ₺{pos.contributionTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} (
                      {pos.portfolioImpactPp >= 0 ? '+' : ''}
                      {pos.portfolioImpactPp.toFixed(2)} p)
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-text-primary">
                      ₺{pos.stressedValueTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2.5 px-2 text-[11px] text-text-muted max-w-xs">
                      {pos.assumptions.join(' • ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
