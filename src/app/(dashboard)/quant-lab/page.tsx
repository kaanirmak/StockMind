'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Users,
  Calculator,
  ShieldCheck,
  Shuffle,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from '@/components/quant/QuantIcons';
import InvestmentCommitteeTab from '@/components/quant/InvestmentCommitteeTab';
import DCFValuationTab from '@/components/quant/DCFValuationTab';
import FinancialHealthTab from '@/components/quant/FinancialHealthTab';
import StressTestTab from '@/components/quant/StressTestTab';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import Link from 'next/link';

type QuantTabId = 'committee' | 'dcf' | 'health' | 'stress';

interface TabItem {
  id: QuantTabId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
}

const TABS: TabItem[] = [
  {
    id: 'committee',
    label: 'Yatırım Komitesi (Çoklu AI)',
    shortLabel: 'Yatırım Komitesi',
    icon: Users,
    badge: 'AI Hub',
    description: '4 Efsane fon yöneticisinin çoklu ajan simülasyonu ve konsensüs kararı',
  },
  {
    id: 'dcf',
    label: 'Otomatik DCF Değerleme',
    shortLabel: 'DCF Değerleme',
    icon: Calculator,
    badge: 'Kantitatif',
    description: '5 Yıllık serbest nakit akımı iskonto motoru, adil değer ve duyarlılık matrisi',
  },
  {
    id: 'health',
    label: 'Finansal Sağlık & Skorlar',
    shortLabel: 'Finansal Sağlık',
    icon: ShieldCheck,
    badge: 'Piotroski & Altman',
    description: 'Piotroski F-Score (0-9), Altman Z-Score iflas analizi ve DuPont kârlılık ağacı',
  },
  {
    id: 'stress',
    label: 'Monte Carlo & Stres Testi',
    shortLabel: 'Monte Carlo',
    icon: Shuffle,
    badge: '10.000 Koşu',
    description: '10.000 Olasılıksal getiri simülasyonu ve makro kriz şok testleri',
  },
];

const BENCHMARK_SYMBOLS = ['THYAO', 'ASELS', 'FROTO', 'TUPRS', 'KCHOL', 'BIMAS'];

export default function QuantLabPage() {
  const [activeTab, setActiveTab] = useState<QuantTabId>('committee');
  const { getSummary, fetchPortfoliosAndTransactions } = usePortfolioStore();

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  const summary = getSummary();
  // Filter for stock holdings from active portfolio
  const portfolioStocks = useMemo(() => {
    return (summary.holdings || []).filter((h) => h.assetType === 'stock');
  }, [summary.holdings]);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('THYAO');

  // Once portfolio stocks are loaded, auto-select the user's primary portfolio stock
  useEffect(() => {
    if (portfolioStocks.length > 0) {
      const inPortfolio = portfolioStocks.some(
        (h) => h.symbol.toUpperCase() === selectedSymbol.toUpperCase()
      );
      if (!inPortfolio) {
        setSelectedSymbol(portfolioStocks[0].symbol);
      }
    }
  }, [portfolioStocks]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="glass-card p-5 sm:p-7 rounded-3xl border border-border bg-gradient-to-r from-accent/10 via-bg-card to-transparent relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent to-accent-secondary flex items-center justify-center text-white shadow-lg shadow-accent/25">
                <Cpu className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
                Quant Lab
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-accent/15 border border-accent/30 text-accent">
                PRO TERMINAL
              </span>
            </div>
            <p className="text-xs sm:text-sm text-text-muted max-w-2xl leading-relaxed">
              İleri seviye temel ve kantitatif değerleme modelleri, 4 efsane yatırımcı personasıyla çoklu AI komitesi simülasyonu, DCF adil değerleme motoru ve makro stres testleri.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <Link
              href="/portfolio"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border transition-colors flex items-center gap-1.5"
            >
              <span>Portföyüm</span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
            </Link>
            <Link
              href="/ai-assistant"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-all flex items-center gap-1.5 shadow-md shadow-accent/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Danışman</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Portfolio Stocks Synchronized Bar (Dedicated Quant Asset Selector) */}
      <div className="glass-card p-4 rounded-2xl border border-border bg-gradient-to-r from-bg-card via-accent/5 to-bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
              <span className="text-sm">💼</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-primary">
                  {portfolioStocks.length > 0
                    ? `Portföyünüzdeki Hisseler (${portfolioStocks.length} Adet)`
                    : 'Portföy Hisseleri Entegrasyonu'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                  Canlı Senkronize
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                {portfolioStocks.length > 0
                  ? 'Seçtiğiniz hisse tüm 4 Quant modeline (Komite, DCF, Skorlar, Monte Carlo) anlık aktarılır.'
                  : 'Portföyünüzde hisse bulunmuyor. Gösterge hisseleriyle test edebilir veya portföyünüze hisse ekleyebilirsiniz.'}
              </p>
            </div>
          </div>

          {/* Quick Add link if portfolio is empty */}
          {portfolioStocks.length === 0 && (
            <Link
              href="/portfolio"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 transition-colors flex items-center gap-1.5 shrink-0 self-start md:self-auto"
            >
              <span>+ Portföye Hisse Ekle</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {/* Horizontal Chips: User's Portfolio Stocks */}
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {portfolioStocks.length > 0 ? (
            portfolioStocks.map((h) => {
              const isSelected = selectedSymbol.toUpperCase() === h.symbol.toUpperCase();
              return (
                <button
                  key={h.symbol}
                  onClick={() => setSelectedSymbol(h.symbol)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                    isSelected
                      ? 'bg-accent text-white shadow-md shadow-accent/25 ring-2 ring-accent/40 scale-[1.02]'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border'
                  }`}
                >
                  <span className="font-black tracking-tight">{h.symbol}</span>
                  <span className="text-[11px] opacity-90">₺{h.currentPrice.toFixed(2)}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : h.pnlPercent >= 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    %{h.pnlPercent >= 0 ? '+' : ''}
                    {h.pnlPercent.toFixed(1)}
                  </span>
                  <span
                    className={`text-[10px] px-1 py-0.5 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-bg-tertiary text-text-muted'
                    }`}
                  >
                    %{h.weight.toFixed(0)} Pay
                  </span>
                </button>
              );
            })
          ) : (
            BENCHMARK_SYMBOLS.map((sym) => {
              const isSelected = selectedSymbol.toUpperCase() === sym.toUpperCase();
              return (
                <button
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary border border-border'
                  }`}
                >
                  {sym}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Segmented Navigation Tab Bar (Mobile Friendly Scroll) */}
      <div className="bg-bg-card border border-border p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-accent'}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>

              {tab.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-accent/10 text-accent'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content (All Synchronized with selectedSymbol and portfolioStocks) */}
      <div className="transition-all duration-200">
        {activeTab === 'committee' && (
          <InvestmentCommitteeTab
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            portfolioStocks={portfolioStocks}
          />
        )}
        {activeTab === 'dcf' && (
          <DCFValuationTab
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            portfolioStocks={portfolioStocks}
          />
        )}
        {activeTab === 'health' && (
          <FinancialHealthTab
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            portfolioStocks={portfolioStocks}
          />
        )}
        {activeTab === 'stress' && (
          <StressTestTab
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            portfolioStocks={portfolioStocks}
          />
        )}
      </div>
    </div>
  );
}
