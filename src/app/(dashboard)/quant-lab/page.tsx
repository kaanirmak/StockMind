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
} from '@/components/quant/QuantIcons';
import InvestmentCommitteeTab from '@/components/quant/InvestmentCommitteeTab';
import DCFValuationTab from '@/components/quant/DCFValuationTab';
import FinancialHealthTab from '@/components/quant/FinancialHealthTab';
import StressTestTab from '@/components/quant/StressTestTab';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ProRequestModal } from '@/components/pro/ProRequestModal';
import { Button } from '@/components/ui/Button';

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


export default function QuantLabPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [showProModal, setShowProModal] = useState(false);
  const [activeTab, setActiveTab] = useState<QuantTabId>('committee');
  const { getSummary, fetchPortfoliosAndTransactions } = usePortfolioStore();

  const isPro = Boolean(
    user?.app_metadata?.plan === 'pro' ||
    user?.app_metadata?.is_pro === true ||
    profile?.isPro
  );

  const isPending =
    profile?.proRequestStatus === 'pending' ||
    user?.user_metadata?.pro_request_status === 'pending';

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

  if (authLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-pulse">
        <div className="h-40 rounded-3xl bg-bg-card/60 border border-border" />
        <div className="h-28 rounded-2xl bg-bg-card/60 border border-border" />
        <div className="h-96 rounded-3xl bg-bg-card/60 border border-border" />
      </div>
    );
  }

  // Entire Quant Lab is reserved for Pro members
  if (!isPro) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto pb-16">
        {/* Top Header Banner */}
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-border bg-gradient-to-r from-amber-500/10 via-bg-card to-violet-500/10 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
                  <Cpu className="w-6 h-6" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
                  Quant Lab
                </h1>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-amber-500 flex items-center gap-1">
                  <span>🔒</span> PRO ÖZEL
                </span>
              </div>
              <p className="text-xs sm:text-sm text-text-muted max-w-2xl leading-relaxed">
                Kurumsal seviye değerleme modelleri, 4 efsane fon yöneticisi personasıyla çoklu-AI simülasyonu, otomatik DCF ve 10.000 koşulu Monte Carlo stres testleri.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              <Link
                href="/portfolio"
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border transition-colors flex items-center gap-1.5"
              >
                <span>Portföyüme Dön</span>
                <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
              </Link>
            </div>
          </div>
        </div>

        {/* Pro Lock Hero Card */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-bg-card to-violet-600/10 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/30">
              <span className="text-3xl">👑</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
                Quant Lab Terminali Pro Üyelere Açıktır
              </h2>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed">
                Quant Lab içerisindeki tüm kantitatif analiz motorları, çoklu-AI yatırım komitesi simülasyonu ve gelişmiş makro stres testleri profesyonel yatırımcılar için tasarlanmıştır.
              </p>
            </div>

            {/* Status & CTA Container */}
            <div className="p-4 sm:p-5 rounded-2xl bg-bg-card/70 border border-border/80 max-w-xl mx-auto space-y-3">
              {isPending ? (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>⏳ Pro Talebiniz İnceleniyor — Yönetici Onayı Bekleniyor</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Başvurunuz sistem yöneticimize iletildi. E-posta üzerinden onay verildiğinde hesabınız anında Pro seviyesine yükseltilecek ve Quant Lab kullanımınıza açılacaktır.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProModal(true)}
                    className="text-xs font-semibold text-text-primary"
                  >
                    Talebi Görüntüle / Güncelle
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-text-muted">
                    <span>Mevcut Plan:</span>
                    <span className="px-2 py-0.5 rounded-md bg-bg-secondary text-text-primary font-bold border border-border">
                      Standart (Ücretsiz)
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setShowProModal(true)}
                    className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-extrabold shadow-xl shadow-amber-500/25 transition-all text-sm cursor-pointer"
                  >
                    🚀 Pro Hesap İste (Yönetici Onaylı)
                  </Button>
                  <p className="text-[11px] text-text-muted">
                    Talep gönderdiğinizde yöneticiye onay e-postası iletilir ve hesabınız onaylandığında bilgilendirilirsiniz.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 Feature Preview Cards Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Quant Lab ile Açılacak Pro Araçlar</span>
            </h3>
            <span className="text-xs text-text-muted">4 İleri Seviye Model</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <div
                  key={tab.id}
                  className="glass-card p-5 rounded-2xl border border-border/80 bg-bg-card/60 hover:bg-bg-card hover:border-amber-500/30 transition-all space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                          {tab.label}
                        </h4>
                        <span className="text-[11px] font-semibold text-amber-500">
                          {tab.badge}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-bg-secondary text-text-muted border border-border font-mono flex items-center gap-1">
                      <span>🔒</span> Pro
                    </span>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed">
                    {tab.description}
                  </p>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-text-secondary">
                    <span className="font-medium">
                      {tab.id === 'committee' && 'Warren Buffett, Peter Lynch, Jim Simons, Michael Burry'}
                      {tab.id === 'dcf' && 'Dinamik WACC, 5Y FCF, 2D Duyarlılık Matrisi'}
                      {tab.id === 'health' && 'Piotroski F-Score (0-9), Altman Z, 3 Kademeli DuPont'}
                      {tab.id === 'stress' && '10.000 Koşulu GBM Simülasyonu, %95 VaR, Kur & Faiz Şoku'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal for Pro Request */}
        <ProRequestModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Banner - Compact with 'Nasıl çalışır?' Disclosure */}
      <div className="glass-card p-3.5 sm:p-5 rounded-2xl border border-border bg-gradient-to-r from-accent/10 via-bg-card to-transparent relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent to-accent-secondary flex items-center justify-center text-white shadow-sm shadow-accent/25">
                <Cpu className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-text-primary tracking-tight">
                Quant Lab
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/15 border border-accent/30 text-accent">
                PRO TERMINAL
              </span>
            </div>

            {/* Collapsible 'Nasıl çalışır?' disclosure */}
            <details className="group mt-1.5">
              <summary className="text-xs text-accent hover:underline cursor-pointer list-none font-semibold flex items-center gap-1">
                <span>Nasıl çalışır?</span>
                <span className="transition-transform group-open:rotate-180 text-[10px]">▼</span>
              </summary>
              <p className="text-xs text-text-muted mt-2 max-w-2xl leading-relaxed p-2.5 bg-bg-secondary/70 rounded-xl border border-border/50">
                İleri seviye temel ve kantitatif değerleme modelleri: 4 efsane yatırımcı personasıyla çoklu AI komitesi simülasyonu, 5 yıllık DCF adil değerleme motoru, Piotroski & Altman finansal sağlık skorları ve 10.000 koşulu Monte Carlo stres testleri.
              </p>
            </details>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Link
              href="/portfolio"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border transition-colors flex items-center gap-1.5"
            >
              <span>Portföyüm</span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
            </Link>
            <Link
              href="/ai-assistant"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-all flex items-center gap-1.5 shadow-sm shadow-accent/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Danışman</span>
            </Link>
          </div>
        </div>
      </div>


      {/* Segmented Navigation Tab Bar (Mobile Friendly Scroll) */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-bg-card p-1.5 shadow-sm sm:flex sm:flex-wrap" aria-label="Quant Lab analizleri">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={isActive}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-2 px-2 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                  className={`hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
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
