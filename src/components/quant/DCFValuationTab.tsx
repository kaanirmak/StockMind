'use client';
import QuantSymbolSelect from './QuantSymbolSelect';
import QuantProfileBanner from './QuantProfileBanner';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useMemo, useEffect } from 'react';
import {
  Calculator,
  TrendingUp,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  Sliders,
  DollarSign,
  Scale,
} from '@/components/quant/QuantIcons';
import {
  calculateDCF,
  getQuantCurrency,
  resolveDcfHoldingMarketInputs,
  DCFParams,
  getFinancialProfile,
  PRESET_FINANCIAL_PROFILES,
} from '@/lib/quant/models';
import { extractPeriodicDcfInputs } from '@/lib/quant/periodicDcf';
import {
  buildDCFScenarioComparison,
  DEFAULT_BEAR_OVERRIDES,
  DEFAULT_BULL_OVERRIDES,
} from '@/lib/quant/scenarioComparison';
import type { FinancialStatementsReport, StatementPeriodType } from '@/lib/market/financialStatements';
import { Holding } from '@/types/portfolio';

interface DCFValuationTabProps {
  selectedSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
  portfolioStocks?: Holding[];
}

export default function DCFValuationTab({
  selectedSymbol,
  onSelectSymbol,
  portfolioStocks = [],
}: DCFValuationTabProps) {
  const initialSym = selectedSymbol || portfolioStocks[0]?.symbol || 'THYAO';
  const [selectedPreset, setSelectedPreset] = useState<string>(initialSym);

  // Active holding in portfolio if user owns this stock
  const activeHolding = useMemo(() => {
    return portfolioStocks.find(
      (h) => h.symbol.toUpperCase() === selectedPreset.toUpperCase()
    );
  }, [portfolioStocks, selectedPreset]);

  const holdingMarket = resolveDcfHoldingMarketInputs(selectedPreset, activeHolding);
  const nativeCurrency = holdingMarket.currency ?? getQuantCurrency(selectedPreset, activeHolding?.originalCurrency);
  const currencySign = nativeCurrency === 'USD' ? '$' : '₺';
  const holdingPrice = holdingMarket.currentPrice;
  const averageCostSign = holdingMarket.averageCostCurrency === 'USD' ? '$' : '₺';

  // Initial parameters based on preset & live price
  const presetData = useMemo(() => {
    return getFinancialProfile(selectedPreset, holdingPrice);
  }, [selectedPreset, holdingPrice]);

  const [currentPrice, setCurrentPrice] = useState<number>(presetData.currentPrice);
  const [freeCashFlow, setFreeCashFlow] = useState<number>(presetData.freeCashFlow);
  const [growthRate5Y, setGrowthRate5Y] = useState<number>(presetData.growthRate5Y);
  const [terminalGrowthRate, setTerminalGrowthRate] = useState<number>(presetData.terminalGrowthRate);
  const [wacc, setWacc] = useState<number>(presetData.wacc);
  const [netDebt, setNetDebt] = useState<number>(presetData.netDebt);
  const [sharesOutstanding, setSharesOutstanding] = useState<number>(presetData.sharesOutstanding);
  const [statementReport, setStatementReport] = useState<FinancialStatementsReport | null>(null);
  const [periodType, setPeriodType] = useState<StatementPeriodType>('annual');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [loadingFinancials, setLoadingFinancials] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoadingFinancials(true);
    setSelectedPeriodId('');
    fetch(`/api/stocks/${encodeURIComponent(selectedPreset)}/financials`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        const report = json && json.annual ? (json as FinancialStatementsReport) : null;
        setStatementReport(report);
      })
      .catch(() => {
        if (!active) return;
        setStatementReport(null);
      })
      .finally(() => {
        if (active) setLoadingFinancials(false);
      });
    return () => {
      active = false;
    };
  }, [selectedPreset]);

  const periodicInputs = useMemo(
    () =>
      extractPeriodicDcfInputs({
        symbol: selectedPreset,
        report: statementReport,
        periodType,
        periodId: selectedPeriodId || null,
        fallbackCurrency: nativeCurrency,
        quoteSharesMillions: presetData.sharesOutstanding,
        fallbackSharesLabel: `${presetData.profileMeta.sourceLabel} (Pay Adedi)`,
      }),
    [selectedPreset, statementReport, periodType, selectedPeriodId, nativeCurrency, presetData]
  );

  useEffect(() => {
    if (!periodicInputs.isSourced) return;
    if (periodicInputs.freeCashFlowMillions !== null) {
      setFreeCashFlow(periodicInputs.freeCashFlowMillions);
    }
    if (periodicInputs.netDebtMillions !== null) {
      setNetDebt(periodicInputs.netDebtMillions);
    }
  }, [periodicInputs.periodId, periodicInputs.periodType, periodicInputs.freeCashFlowMillions, periodicInputs.netDebtMillions, periodicInputs.isSourced]);

  // Synchronize when external selectedSymbol prop changes
  useEffect(() => {
    if (selectedSymbol && selectedSymbol.toUpperCase() !== selectedPreset.toUpperCase()) {
      handleSelectPreset(selectedSymbol);
    }
  }, [selectedSymbol]);

  // When changing preset, update all inputs
  const handleSelectPreset = (sym: string) => {
    const cleanSym = sym.trim().toUpperCase();
    setSelectedPreset(cleanSym);
    onSelectSymbol?.(cleanSym);
    const holding = portfolioStocks.find((h) => h.symbol.toUpperCase() === cleanSym);
    const nextMarket = resolveDcfHoldingMarketInputs(cleanSym, holding);
    const p = getFinancialProfile(cleanSym, nextMarket.currentPrice);
    setCurrentPrice(p.currentPrice);
    setFreeCashFlow(p.freeCashFlow);
    setGrowthRate5Y(p.growthRate5Y);
    setTerminalGrowthRate(p.terminalGrowthRate);
    setWacc(p.wacc);
    setNetDebt(p.netDebt);
    setSharesOutstanding(p.sharesOutstanding);
  };

  // Calculate live DCF result
  const dcfParams = useMemo<DCFParams>(
    () => ({
      symbol: selectedPreset,
      currentPrice,
      freeCashFlow,
      growthRate5Y,
      terminalGrowthRate,
      wacc,
      netDebt,
      sharesOutstanding,
      currency: nativeCurrency,
      statementCurrency: nativeCurrency,
      priceCurrency: nativeCurrency,
    }),
    [
      selectedPreset,
      nativeCurrency,
      currentPrice,
      freeCashFlow,
      growthRate5Y,
      terminalGrowthRate,
      wacc,
      netDebt,
      sharesOutstanding,
    ]
  );

  const dcfResult = useMemo(() => calculateDCF(dcfParams), [dcfParams]);

  const [bullGrowthDelta, setBullGrowthDelta] = useState<number>(DEFAULT_BULL_OVERRIDES.fcfGrowthDeltaPct);
  const [bearGrowthDelta, setBearGrowthDelta] = useState<number>(DEFAULT_BEAR_OVERRIDES.fcfGrowthDeltaPct);

  const scenarioComparison = useMemo(
    () =>
      buildDCFScenarioComparison(dcfParams, {
        bull: { fcfGrowthDeltaPct: bullGrowthDelta },
        bear: { fcfGrowthDeltaPct: bearGrowthDelta },
      }),
    [dcfParams, bullGrowthDelta, bearGrowthDelta]
  );

  const upsideDownsidePercent = Math.abs(dcfResult.discountRate);
  const isCheap = dcfResult.isUndervalued;
  const isUserCustomized =
    currentPrice !== presetData.currentPrice ||
    freeCashFlow !== presetData.freeCashFlow ||
    growthRate5Y !== presetData.growthRate5Y ||
    terminalGrowthRate !== presetData.terminalGrowthRate ||
    wacc !== presetData.wacc ||
    netDebt !== presetData.netDebt ||
    sharesOutstanding !== presetData.sharesOutstanding;

  return (
    <div className="space-y-6">
      <QuantProfileBanner
        symbol={selectedPreset}
        meta={presetData.profileMeta}
        isUserCustomized={isUserCustomized}
      />
      {/* Analysis header and symbol selection */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Calculator className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-text-primary">
                Otomatik İndirgenmiş Nakit Akımı (DCF) Motoru
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Gelecek 5 yıllık serbest nakit akımlarını (FCF) iskonto ederek şirketin gerçek içsel adil değerini (Fair Value) ve iskonto marjını hesaplayın.
            </p>
          </div>

          <QuantSymbolSelect
            value={selectedPreset}
            onChange={handleSelectPreset}
            portfolioStocks={portfolioStocks}
            fallbackSymbols={Object.keys(PRESET_FINANCIAL_PROFILES)}
          />
        </div>

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
                <span className="font-bold text-text-primary ml-1">{averageCostSign}{(holdingMarket.averageCost ?? activeHolding.averageCost).toFixed(2)}</span>
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

      {/* Girdi Dönemi ve Kaynak Doğrulaması (QNT-07) */}
      <div
        data-testid="dcf-periodic-provenance"
        className="rounded-xl border border-border/70 bg-bg-secondary/40 p-3 space-y-2.5 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-text-primary">
            Dönemsel Girdi Kaynakları ({selectedPreset})
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setPeriodType('annual');
                setSelectedPeriodId('');
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                periodType === 'annual' ? 'bg-accent text-white' : 'bg-bg-card text-text-secondary'
              }`}
            >
              Yıllık
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodType('quarterly');
                setSelectedPeriodId('');
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                periodType === 'quarterly' ? 'bg-accent text-white' : 'bg-bg-card text-text-secondary'
              }`}
            >
              Çeyreklik
            </button>
            {periodicInputs.availablePeriods.length > 0 && (
              <select
                aria-label="Finansal dönem seçin"
                value={selectedPeriodId || periodicInputs.periodId || ''}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="px-2 py-1 rounded-md border border-border bg-bg-card text-[11px] text-text-primary"
              >
                {periodicInputs.availablePeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.endDate})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {loadingFinancials ? (
          <p className="text-[11px] text-text-muted">Dönemsel nakit akışı ve bilanço verileri kontrol ediliyor...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-bg-card/80 border border-border/50 p-2">
              <div className="text-text-muted">Serbest Nakit Akışı (FCF)</div>
              <div className="font-mono font-bold text-text-primary">
                {freeCashFlow.toFixed(1)} M {currencySign}
              </div>
              <div className="text-accent text-[10px] mt-0.5">{periodicInputs.fcfSourceLabel}</div>
            </div>
            <div className="rounded-lg bg-bg-card/80 border border-border/50 p-2">
              <div className="text-text-muted">Net Borç</div>
              <div className="font-mono font-bold text-text-primary">
                {netDebt.toFixed(1)} M {currencySign}
              </div>
              <div className="text-accent text-[10px] mt-0.5">{periodicInputs.netDebtSourceLabel}</div>
            </div>
            <div className="rounded-lg bg-bg-card/80 border border-border/50 p-2">
              <div className="text-text-muted">Pay Adedi (Lot)</div>
              <div className="font-mono font-bold text-text-primary">
                {sharesOutstanding.toFixed(1)} M
              </div>
              <div className="text-accent text-[10px] mt-0.5">{periodicInputs.sharesSourceLabel}</div>
            </div>
          </div>
        )}
      </div>

      {/* Sektörel Model Uyarısı (Örn: Bankalar) */}
      {dcfResult.modelApplicabilityWarning && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-amber-200">Sektörel Model Uyarısı</span>
            <p className="mt-0.5 text-amber-300/90 leading-relaxed">{dcfResult.modelApplicabilityWarning}</p>
          </div>
        </div>
      )}

      {/* Hero: Fair Value Comparison Card */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border bg-gradient-to-br from-bg-card via-transparent to-accent/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Market Price */}
          <div className="p-4 rounded-xl bg-bg-secondary/60 border border-border">
            <span className="text-xs font-semibold text-text-muted block uppercase tracking-wider">
              Cari Piyasa Fiyatı
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-text-primary">
                {currencySign}{currentPrice.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              {nativeCurrency} son işlem fiyatı
            </p>
            {holdingMarket.mismatchWarning && (
              <p
                data-testid="dcf-currency-warning"
                className="text-[11px] text-amber-400 mt-1 leading-snug"
              >
                {holdingMarket.mismatchWarning}
              </p>
            )}
          </div>

          {/* Calculated Fair Value */}
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 relative overflow-hidden">
            <span className="text-xs font-semibold text-accent block uppercase tracking-wider">
              Hesaplanan İçsel Adil Değer
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-accent">
                {currencySign}{dcfResult.fairValuePerShare.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-accent/80 mt-1">
              5 Yıllık Projeksiyon + Terminal Değer
            </p>
          </div>

          {/* Upside / Downside Verdict */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between ${
              isCheap
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider block opacity-80">
                Değerleme Hükmü
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                {isCheap ? (
                  <ArrowUpRight className="w-5 h-5 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 shrink-0" />
                )}
                <span className="text-xl sm:text-2xl font-black">
                  {isCheap ? `%${upsideDownsidePercent.toFixed(1)} İskontolu` : `%${upsideDownsidePercent.toFixed(1)} Primli`}
                </span>
              </div>
            </div>
            <p className="text-[11px] mt-2 font-medium opacity-90">
              {dcfResult.verdict}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Sliders Section */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent" />
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              İnteraktif Değerleme Parametreleri & Duyarlılık
            </h3>
          </div>
          <span className="text-xs text-text-muted font-medium">
            Canlı Yeniden Hesaplanır
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Slider 1: WACC */}
          <div className="space-y-2 p-4 rounded-xl bg-bg-secondary/40 border border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary flex items-center gap-1">
                <span>AOMM / WACC</span>
                <span className="text-accent">({wacc}%)</span>
              </label>
              <span className="text-[11px] text-text-muted">İskonto Oranı</span>
            </div>
            <input
              type="range"
              min="4"
              max="25"
              step="0.5"
              value={wacc}
              onChange={(e) => setWacc(parseFloat(e.target.value))}
              className="w-full accent-accent h-2 bg-bg-input rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>%4 (Düşük Risk)</span>
              <span>%14.5</span>
              <span>%25 (Yüksek Risk)</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-snug">
              Özkaynak ve borç maliyetinin ağırlıklı ortalaması. Enflasyonist ortamda yüksek tutulur.
            </p>
          </div>

          {/* Slider 2: 5Y Growth Rate */}
          <div className="space-y-2 p-4 rounded-xl bg-bg-secondary/40 border border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary flex items-center gap-1">
                <span>5-Yıllık FCF Büyümesi</span>
                <span className="text-accent">({growthRate5Y}%)</span>
              </label>
              <span className="text-[11px] text-text-muted">Yıllık Büyüme</span>
            </div>
            <input
              type="range"
              min="5"
              max="35"
              step="1"
              value={growthRate5Y}
              onChange={(e) => setGrowthRate5Y(parseFloat(e.target.value))}
              className="w-full accent-accent h-2 bg-bg-input rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>%5 (Muhafazakar)</span>
              <span>%20</span>
              <span>%35 (Agresif)</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-snug">
              Şirketin serbest nakit akışını önümüzdeki 5 yıl boyunca yıllık artırma hızı.
            </p>
          </div>

          {/* Slider 3: Terminal Growth Rate */}
          <div className="space-y-2 p-4 rounded-xl bg-bg-secondary/40 border border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary flex items-center gap-1">
                <span>Uç (Terminal) Büyüme</span>
                <span className="text-accent">({terminalGrowthRate}%)</span>
              </label>
              <span className="text-[11px] text-text-muted">Sonsuz Büyüme</span>
            </div>
            <input
              type="range"
              min="3"
              max="8"
              step="0.5"
              value={terminalGrowthRate}
              onChange={(e) => setTerminalGrowthRate(parseFloat(e.target.value))}
              className="w-full accent-accent h-2 bg-bg-input rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>%3 (GSYİH Altı)</span>
              <span>%5.5</span>
              <span>%8 (GSYİH Üstü)</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-snug">
              5. yıldan sonra şirketin sonsuza kadar ekonominin büyüme hızına paralel büyüme tahmini.
            </p>
          </div>
        </div>

        {dcfResult.assumptionValidation.spreadAdjusted && (
          <div
            data-testid="dcf-wacc-validation-banner"
            className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5"
          >
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                Geçersiz Varsayım Düzeltildi (Girilen AOMM: %{dcfResult.assumptionValidation.requestedWacc.toFixed(1)} → Etkin AOMM: %{dcfResult.assumptionValidation.effectiveWacc.toFixed(1)})
              </div>
              <p className="text-[11px] text-amber-200/90 leading-snug">
                {dcfResult.assumptionValidation.message}
              </p>
            </div>
          </div>
        )}

        {/* Detailed Financial Inputs Toggle */}
        <div className="pt-2 border-t border-border">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-3">
            Girdi Bilanço Verileri (Milyon {nativeCurrency} / Adet)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-text-muted block">Başlangıç FCF (Milyon {nativeCurrency})</span>
              <input
                type="number"
                value={freeCashFlow}
                onChange={(e) => setFreeCashFlow(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none mt-1"
              />
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Net Borç (Milyon {nativeCurrency})</span>
              <input
                type="number"
                value={netDebt}
                onChange={(e) => setNetDebt(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none mt-1"
              />
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Ödenmiş Sermaye (Milyon Lot)</span>
              <input
                type="number"
                value={sharesOutstanding}
                onChange={(e) => setSharesOutstanding(parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none mt-1"
              />
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Cari Piyasa Fiyatı ({nativeCurrency})</span>
              <span
                data-testid="dcf-currency-consistency-badge"
                className="text-[10px] text-emerald-400/90 block mt-0.5"
              >
                Bilanço: {dcfResult.currencyConsistency.statementCurrency} • İşlem Fiyatı: {dcfResult.currencyConsistency.priceCurrency} • Değerleme: {dcfResult.currencyConsistency.valuationCurrency}
              </span>
              <input
                type="number"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5-Year Projections Table */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <span>5-Yıllık Serbest Nakit Akışı İndirgeme Tablosu</span>
          </h3>
          <span className="text-xs text-text-muted">Değerler Milyon {nativeCurrency}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted font-bold">
                <th className="py-2 px-3">Projeksiyon Yılı</th>
                <th className="py-2 px-3 text-right">Tahmini FCF</th>
                <th className="py-2 px-3 text-right">İndirgeme Faktörü (1/(1+WACC)^t)</th>
                <th className="py-2 px-3 text-right">Bugünkü Değer (PV)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dcfResult.projections.map((row) => (
                <tr key={row.year} className="hover:bg-bg-hover/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-text-primary">
                    Yıl {row.year} ({new Date().getFullYear() + row.year})
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-text-primary">
                    {currencySign}{row.cashFlow.toLocaleString('tr-TR')} M
                  </td>
                  <td className="py-2.5 px-3 text-right text-text-muted font-mono">
                    {row.discountFactor}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-accent">
                    {currencySign}{row.presentValue.toLocaleString('tr-TR')} M
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-bold bg-bg-secondary/30">
                <td className="py-2 px-3 text-text-primary">
                  5 Yıllık Nakit Akımları Toplamı (PV)
                </td>
                <td colSpan={2}></td>
                <td className="py-2 px-3 text-right text-accent">
                  {currencySign}{dcfResult.sumPVScheduled.toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t border-border/50 text-text-secondary">
                <td className="py-2 px-3">
                  Terminal Değer (Sonsuzluk Bugünkü Değeri)
                </td>
                <td colSpan={2}></td>
                <td className="py-2 px-3 text-right font-bold text-text-primary">
                  {currencySign}{dcfResult.pvTerminalValue.toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t border-border/50 text-text-secondary">
                <td className="py-2 px-3">Firma Değeri (Enterprise Value)</td>
                <td colSpan={2}></td>
                <td className="py-2 px-3 text-right font-bold text-text-primary">
                  {currencySign}{dcfResult.enterpriseValue.toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t border-border/50 text-text-secondary">
                <td className="py-2 px-3">Eksi: Net Borç</td>
                <td colSpan={2}></td>
                <td className="py-2 px-3 text-right font-bold text-rose-400">
                  {currencySign}{(-netDebt).toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t-2 border-border font-black text-sm bg-accent/5">
                <td className="py-3 px-3 text-text-primary">
                  Toplam Özkaynak Değeri (Equity Value)
                </td>
                <td colSpan={2}></td>
                <td className="py-3 px-3 text-right text-accent">
                  {currencySign}{dcfResult.equityValue.toLocaleString('tr-TR')} M
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3x3 Sensitivity Matrix */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
              <Scale className="w-4 h-4 text-accent" />
              <span>Duyarlılık Matrisi (Sensitivity Matrix)</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Farklı WACC ve Büyüme senaryolarında hisse başı adil değer matrisi (Yeşil: Cari fiyattan ucuz, Kırmızı: Pahalı).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-3 text-left text-text-muted font-bold">
                  WACC \ Büyüme
                </th>
                {dcfResult.sensitivityMatrix.growthRates.map((gRate) => (
                  <th key={gRate} className="py-2 px-3 font-bold text-text-primary">
                    %{gRate} Büyüme
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dcfResult.sensitivityMatrix.waccRates.map((wRate, wIdx) => {
                const isRowAdjusted = dcfResult.sensitivityMatrix.adjustedCells[wIdx]?.[0];
                const effectiveWRate = dcfResult.sensitivityMatrix.effectiveWaccRates[wIdx] ?? wRate;
                return (
                <tr key={wRate}>
                  <td className="py-2.5 px-3 text-left font-bold text-text-muted">
                    {isRowAdjusted ? (
                      <span data-testid="dcf-sensitivity-adjusted-wacc" className="text-amber-400">
                        %{wRate} → %{effectiveWRate} WACC (Düz.)
                      </span>
                    ) : (
                      `%${wRate} WACC`
                    )}
                  </td>
                  {dcfResult.sensitivityMatrix.growthRates.map((_, gIdx) => {
                    const fairVal = dcfResult.sensitivityMatrix.grid[wIdx][gIdx];
                    const isAbove = fairVal >= currentPrice;
                    const isCenter = wIdx === 1 && gIdx === 1;

                    return (
                      <td
                        key={gIdx}
                        className={`py-2.5 px-3 font-mono font-bold transition-all ${
                          isCenter ? 'ring-2 ring-accent rounded-lg font-black' : ''
                        } ${
                          isAbove
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {currencySign}{fairVal.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Scenario Comparison (QNT-11) */}
      <div
        data-testid="scenario-comparison-table"
        className="glass-card p-5 sm:p-6 rounded-2xl border border-border space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
              <Scale className="w-4 h-4 text-accent" />
              <span>Baz, İyimser ve Olumsuz Senaryo Karşılaştırması</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Üç senaryonun nakit akışı/iskonto girdilerini ve adil değer sonuçlarını aynı tabloda yan yana inceleyin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <label className="flex items-center gap-1.5 text-text-secondary font-semibold">
              <span>Olumsuz FCF Farkı (%):</span>
              <input
                type="number"
                step={1}
                min={-15}
                max={0}
                value={bearGrowthDelta}
                onChange={(e) => setBearGrowthDelta(Number(e.target.value) || 0)}
                className="w-16 px-2 py-1 rounded-lg bg-bg-input border border-border font-mono font-bold text-rose-400"
              />
            </label>
            <label className="flex items-center gap-1.5 text-text-secondary font-semibold">
              <span>İyimser FCF Farkı (%):</span>
              <input
                type="number"
                step={1}
                min={0}
                max={15}
                value={bullGrowthDelta}
                onChange={(e) => setBullGrowthDelta(Number(e.target.value) || 0)}
                className="w-16 px-2 py-1 rounded-lg bg-bg-input border border-border font-mono font-bold text-emerald-400"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-text-muted font-bold">
                <th className="py-2 px-3">Tür</th>
                <th className="py-2 px-3">Metrik</th>
                <th className="py-2 px-3 text-right text-rose-400">Olumsuz Senaryo</th>
                <th className="py-2 px-3 text-right text-accent">Baz Senaryo</th>
                <th className="py-2 px-3 text-right text-emerald-400">İyimser Senaryo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {scenarioComparison.rows.map((row) => (
                <tr key={row.key} className="hover:bg-bg-hover/40 transition-colors">
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.section === 'Girdi'
                          ? 'bg-bg-secondary text-text-muted'
                          : 'bg-accent/15 text-accent'
                      }`}
                    >
                      {row.section}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-text-primary">{row.label}</td>
                  <td className="py-2 px-3 text-right font-mono text-rose-300">{row.bearValue}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-text-primary">{row.baseValue}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-300">{row.bullValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Şeffaflık & Model Varsayımları Uyarısı */}
      <div className="p-4 rounded-xl bg-bg-secondary/50 border border-border text-[11px] text-text-muted flex items-start gap-2.5">
        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          {dcfResult.assumptionValidation.spreadAdjusted && (
            <p data-testid="dcf-wacc-footer-note" className="mb-2 text-amber-400">
              {dcfResult.assumptionValidation.message}
            </p>
          )}
          <strong className="text-text-secondary font-medium">Model Varsayımları ve Yasal Uyarı:</strong> Bu değerleme motorundaki serbest nakit akımları (FCF), AOMM (WACC) ve terminal büyüme oranları analitik projeksiyon varsayımlarıdır. Başlangıç bilanço girdileri örnek değerlerdir. İşlem fiyatı portföyde mevcutsa oradan, aksi halde örnek profilden alınır. Sonuç girdiğiniz varsayımlara bağlı bir senaryodur.
        </span>
      </div>
    </div>
  );
}
