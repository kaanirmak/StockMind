'use client';

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
  DCFParams,
  getFinancialProfile,
  PRESET_FINANCIAL_PROFILES,
} from '@/lib/quant/models';
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

  // Initial parameters based on preset & live price
  const presetData = useMemo(() => {
    return getFinancialProfile(selectedPreset, activeHolding?.currentPrice);
  }, [selectedPreset, activeHolding?.currentPrice]);

  const [currentPrice, setCurrentPrice] = useState<number>(presetData.currentPrice);
  const [freeCashFlow, setFreeCashFlow] = useState<number>(presetData.freeCashFlow);
  const [growthRate5Y, setGrowthRate5Y] = useState<number>(presetData.growthRate5Y);
  const [terminalGrowthRate, setTerminalGrowthRate] = useState<number>(presetData.terminalGrowthRate);
  const [wacc, setWacc] = useState<number>(presetData.wacc);
  const [netDebt, setNetDebt] = useState<number>(presetData.netDebt);
  const [sharesOutstanding, setSharesOutstanding] = useState<number>(presetData.sharesOutstanding);

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
    const p = getFinancialProfile(cleanSym, holding?.currentPrice);
    setCurrentPrice(p.currentPrice);
    setFreeCashFlow(p.freeCashFlow);
    setGrowthRate5Y(p.growthRate5Y);
    setTerminalGrowthRate(p.terminalGrowthRate);
    setWacc(p.wacc);
    setNetDebt(p.netDebt);
    setSharesOutstanding(p.sharesOutstanding);
  };

  // Calculate live DCF result
  const dcfResult = useMemo(() => {
    const params: DCFParams = {
      symbol: selectedPreset,
      currentPrice,
      freeCashFlow,
      growthRate5Y,
      terminalGrowthRate,
      wacc,
      netDebt,
      sharesOutstanding,
      currency: 'TRY',
    };
    return calculateDCF(params);
  }, [
    selectedPreset,
    currentPrice,
    freeCashFlow,
    growthRate5Y,
    terminalGrowthRate,
    wacc,
    netDebt,
    sharesOutstanding,
  ]);

  const upsideDownsidePercent = Math.abs(dcfResult.discountRate);
  const isCheap = dcfResult.isUndervalued;

  return (
    <div className="space-y-6">
      {/* Top Controls: Preset Chips with Portfolio Priority */}
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

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
            <span className="text-xs font-bold text-accent uppercase tracking-wider mr-1 shrink-0">
              {portfolioStocks.length > 0 ? '💼 Portföy Hisseleriniz:' : 'Şirket:'}
            </span>

            {portfolioStocks.length > 0
              ? portfolioStocks.map((h) => {
                  const isSelected = selectedPreset.toUpperCase() === h.symbol.toUpperCase();
                  return (
                    <button
                      key={h.symbol}
                      onClick={() => handleSelectPreset(h.symbol)}
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
                  const isSelected = selectedPreset === sym;
                  return (
                    <button
                      key={sym}
                      onClick={() => handleSelectPreset(sym)}
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
                ₺{currentPrice.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              BIST son işlem fiyatı
            </p>
          </div>

          {/* Calculated Fair Value */}
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 relative overflow-hidden">
            <span className="text-xs font-semibold text-accent block uppercase tracking-wider">
              Hesaplanan İçsel Adil Değer
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-accent">
                ₺{dcfResult.fairValuePerShare.toFixed(2)}
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
              min="10"
              max="25"
              step="0.5"
              value={wacc}
              onChange={(e) => setWacc(parseFloat(e.target.value))}
              className="w-full accent-accent h-2 bg-bg-input rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>%10 (Düşük Risk)</span>
              <span>%17.5</span>
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

        {/* Detailed Financial Inputs Toggle */}
        <div className="pt-2 border-t border-border">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-3">
            Girdi Bilanço Verileri (Milyon TL / Adet)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-text-muted block">Başlangıç FCF (Milyon TL)</span>
              <input
                type="number"
                value={freeCashFlow}
                onChange={(e) => setFreeCashFlow(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none mt-1"
              />
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Net Borç (Milyon TL)</span>
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
              <span className="text-[10px] text-text-muted block">Cari Piyasa Fiyatı (TL)</span>
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
          <span className="text-xs text-text-muted">Değerler Milyon TL</span>
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
                    ₺{row.cashFlow.toLocaleString('tr-TR')} M
                  </td>
                  <td className="py-2.5 px-3 text-right text-text-muted font-mono">
                    {row.discountFactor}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-accent">
                    ₺{row.presentValue.toLocaleString('tr-TR')} M
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
                  ₺{dcfResult.sumPVScheduled.toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t border-border/50 text-text-secondary">
                <td className="py-2 px-3">
                  Terminal Değer (Sonsuzluk Bugünkü Değeri)
                </td>
                <td colSpan={2}></td>
                <td className="py-2 px-3 text-right font-bold text-text-primary">
                  ₺{dcfResult.pvTerminalValue.toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t border-border/50 text-text-secondary">
                <td className="py-2 px-3">Firma Değeri (Enterprise Value)</td>
                <td colSpan={2}></td>
                <td className="py-2 px-3 text-right font-bold text-text-primary">
                  ₺{dcfResult.enterpriseValue.toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t border-border/50 text-text-secondary">
                <td className="py-2 px-3">Eksi: Net Borç</td>
                <td colSpan={2}></td>
                <td className="py-2 px-3 text-right font-bold text-rose-400">
                  -₺{netDebt.toLocaleString('tr-TR')} M
                </td>
              </tr>
              <tr className="border-t-2 border-border font-black text-sm bg-accent/5">
                <td className="py-3 px-3 text-text-primary">
                  Toplam Özkaynak Değeri (Equity Value)
                </td>
                <td colSpan={2}></td>
                <td className="py-3 px-3 text-right text-accent">
                  ₺{dcfResult.equityValue.toLocaleString('tr-TR')} M
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
              {dcfResult.sensitivityMatrix.waccRates.map((wRate, wIdx) => (
                <tr key={wRate}>
                  <td className="py-2.5 px-3 text-left font-bold text-text-muted">
                    %{wRate} WACC
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
                        ₺{fairVal.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
