'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Award,
  Key,
  HelpCircle,
  ExternalLink,
} from '@/components/quant/QuantIcons';
import {
  CommitteeReport,
  runInvestmentCommittee,
} from '@/lib/ai/investment-committee';
import { useAuth } from '@/hooks/useAuth';
import { Holding } from '@/types/portfolio';
import { getStoredOpenRouterKey } from '@/lib/ai/apiKeyStorage';

const POPULAR_SYMBOLS = [
  { symbol: 'THYAO', name: 'Türk Hava Yolları' },
  { symbol: 'ASELS', name: 'Aselsan' },
  { symbol: 'FROTO', name: 'Ford Otosan' },
  { symbol: 'TUPRS', name: 'Tüpraş' },
  { symbol: 'BIMAS', name: 'BİM Mağazalar' },
  { symbol: 'KCHOL', name: 'Koç Holding' },
  { symbol: 'NVDA', name: 'Nvidia Corp' },
  { symbol: 'AAPL', name: 'Apple Inc' },
];

interface InvestmentCommitteeTabProps {
  selectedSymbol?: string;
  onSelectSymbol?: (sym: string) => void;
  portfolioStocks?: Holding[];
}

export default function InvestmentCommitteeTab({
  selectedSymbol,
  onSelectSymbol,
  portfolioStocks = [],
}: InvestmentCommitteeTabProps) {
  const { user } = useAuth();
  const initialSym = selectedSymbol || portfolioStocks[0]?.symbol || 'THYAO';
  const [symbol, setSymbol] = useState(initialSym);
  const [customInput, setCustomInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<CommitteeReport | null>(null);
  const [customApiKey, setCustomApiKey] = useState('');
  const [deliberationStep, setDeliberationStep] = useState(0);

  const DELIBERATION_STEPS = [
    'Komite üyeleri toplanıyor...',
    'Warren Buffett: Ekonomik hendek ve serbest nakit akışını inceliyor...',
    'Peter Lynch: Büyüme hikayesi ve PEG oranını hesaplıyor...',
    'Jim Simons: Algoritmik momentum ve volatilite sinyallerini tarıyor...',
    'Michael Burry: Makro kırılganlık ve ayı tezlerini oluşturuyor...',
    'Yatırım Komitesi Konsensüs Raporu sentezleniyor...',
  ];

  // Load API key from settings and listen to updates
  useEffect(() => {
    const key = getStoredOpenRouterKey(user?.id);
    if (key) {
      setCustomApiKey(key);
    }

    const handleSync = () => {
      const refreshed = getStoredOpenRouterKey(user?.id);
      setCustomApiKey(refreshed);
    };

    window.addEventListener('stockmind_ai_key_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('stockmind_ai_key_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [user]);

  // Sync external selectedSymbol changes
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      setSymbol(selectedSymbol);
      executeCommittee(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Initial fetch for first symbol
  useEffect(() => {
    executeCommittee(initialSym);
  }, []);

  const executeCommittee = async (targetSymbol: string) => {
    const cleanSym = targetSymbol.trim().toUpperCase();
    if (!cleanSym) return;

    setIsLoading(true);
    setDeliberationStep(0);

    // Synchronously resolve key from memory or storage
    const activeKey = (customApiKey || getStoredOpenRouterKey(user?.id) || '').trim() || undefined;
    if (activeKey && !customApiKey) {
      setCustomApiKey(activeKey);
    }

    // Simulate deliberation progress steps for UI feedback
    const interval = setInterval(() => {
      setDeliberationStep((prev) => (prev < DELIBERATION_STEPS.length - 1 ? prev + 1 : prev));
    }, 450);

    try {
      const activeHolding = portfolioStocks.find((h) => h.symbol.toUpperCase() === cleanSym);
      const quotePayload = activeHolding
        ? {
            price: activeHolding.currentPrice,
            changePercent: activeHolding.dailyChangePercent,
            name: activeHolding.symbol,
            sector: activeHolding.assetType === 'fund' ? 'Yatırım Fonu' : 'Hisse Senedi',
          }
        : undefined;

      // First try API route, with graceful fallback to client-side runner
      const res = await fetch('/api/quant/committee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: cleanSym,
          apiKey: activeKey,
          quote: quotePayload,
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        // Fallback directly to client logic
        const fallback = await runInvestmentCommittee(cleanSym, undefined, activeKey);
        setReport(fallback);
      }
    } catch (e) {
      console.warn('API route failed, using local runner:', e);
      const fallback = await runInvestmentCommittee(cleanSym, undefined, activeKey);
      setReport(fallback);
    } finally {
      clearInterval(interval);
      setIsLoading(false);
      setDeliberationStep(0);
    }
  };

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setCustomInput('');
    onSelectSymbol?.(sym);
    executeCommittee(sym);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      const s = customInput.trim().toUpperCase();
      setSymbol(s);
      onSelectSymbol?.(s);
      executeCommittee(s);
    }
  };

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'GÜÇLÜ AL':
        return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400';
      case 'AL':
        return 'bg-green-500/15 border-green-500/40 text-green-400';
      case 'TUT':
      case 'TUT / DENGELİ':
      case 'TEMKİNLİ':
        return 'bg-amber-500/15 border-amber-500/40 text-amber-400';
      case 'SAT':
      case 'DİKKATLİ / SAT':
        return 'bg-rose-500/15 border-rose-500/40 text-rose-400';
      default:
        return 'bg-blue-500/15 border-blue-500/40 text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Symbol Selector & Key Notice */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-text-primary">
                Yatırım Komitesi AI Simülatörü
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-1">
              4 Efsanevi fon yöneticisi (Buffett, Lynch, Simons, Burry) şirketinizi inceler, tezlerini çarpıştırır ve konsensüs kararı üretir.
            </p>
          </div>

          {/* Quick Custom Input */}
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Sembol örn. THYAO..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="w-36 sm:w-44 px-3 py-2 text-xs font-semibold rounded-xl bg-bg-input border border-border text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-accent/20"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>İnceleniyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Komiteyi Topla</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Chips: Portfolio Stocks Priority */}
        <div className="mt-4 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              {portfolioStocks.length > 0 ? '💼 Portföy Hisseleriniz:' : 'Gösterge Hisseleri:'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {portfolioStocks.length > 0
              ? portfolioStocks.map((h) => {
                  const isSelected = symbol.toUpperCase() === h.symbol.toUpperCase();
                  return (
                    <button
                      key={h.symbol}
                      onClick={() => handleSelectSymbol(h.symbol)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-accent text-white shadow-md shadow-accent/25 ring-2 ring-accent/30'
                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border'
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
              : POPULAR_SYMBOLS.map((item) => {
                  const isSelected = symbol === item.symbol;
                  return (
                    <button
                      key={item.symbol}
                      onClick={() => handleSelectSymbol(item.symbol)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border'
                      }`}
                    >
                      {item.symbol}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* API Key Status Notice */}
        {customApiKey ? (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Canlı LLM Münazarası Aktif:</strong> OpenRouter AI anahtarınız devrede ({customApiKey.slice(0, 6)}...{customApiKey.slice(-4)}). Komite üyeleri canlı yapay zeka ile tartışıyor.
              </span>
            </div>
            <a
              href="/settings"
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] shrink-0 transition-colors flex items-center gap-1"
            >
              <span>Yönet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-500">
              <Key className="w-4 h-4 shrink-0" />
              <span>
                <strong>Analitik Quant Simülasyonu Aktif:</strong> Canlı derin LLM münazarası için Ayarlar sayfasından OpenRouter API anahtarınızı ekleyebilirsiniz.
              </span>
            </div>
            <a
              href="/settings"
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-semibold text-[11px] shrink-0 transition-colors flex items-center gap-1"
            >
              <span>Key Ekle</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Loading Deliberation State */}
      {isLoading && (
        <div className="glass-card p-6 sm:p-8 rounded-2xl border border-accent/30 text-center animate-fade-in space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mx-auto animate-bounce">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-text-primary">
              {DELIBERATION_STEPS[deliberationStep]}
            </h3>
            <p className="text-xs text-text-muted">
              {symbol} için kârlılık, nakit akışı, volatilite ve makro kriz parametreleri simüle ediliyor...
            </p>
          </div>
          <div className="w-full max-w-md mx-auto bg-bg-secondary h-2 rounded-full overflow-hidden border border-border">
            <div
              className="bg-accent h-full transition-all duration-300 ease-out"
              style={{
                width: `${((deliberationStep + 1) / DELIBERATION_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Report View */}
      {!isLoading && report && (
        <div className="space-y-6 animate-fade-in">
          {/* Hero: Consensus Report Banner */}
          <div className="glass-card p-5 sm:p-6 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-transparent to-bg-card relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-bg-secondary text-text-muted border border-border">
                    {report.symbol}
                  </span>
                  <span className="text-sm font-semibold text-text-primary">
                    {report.companyName}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
                    {report.isLiveLLM ? 'Canlı Multi-LLM' : 'Quant Simülasyon Motoru'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-text-primary">
                  Yatırım Komitesi Konsensüs Kararı
                </h3>
                <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
                  {report.consensusSummary}
                </p>
              </div>

              {/* Score and Verdict Badge */}
              <div className="flex items-center sm:flex-col sm:items-end justify-between gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                <div className="text-left sm:text-right">
                  <span className="text-[11px] uppercase tracking-wider text-text-muted block font-semibold">
                    Komite Konsensüs Skoru
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-accent">
                      {report.consensusScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-text-muted font-bold">/ 10</span>
                  </div>
                </div>

                <div
                  className={`px-4 py-2 rounded-xl text-sm sm:text-base font-black border uppercase tracking-wider shadow-md ${getVerdictStyle(
                    report.consensusVerdict
                  )}`}
                >
                  {report.consensusVerdict}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Agent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.agents.map((agent) => (
              <div
                key={agent.id}
                className="glass-card p-5 rounded-2xl border border-border hover:border-accent/40 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Agent Header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center text-2xl shadow-inner shrink-0">
                        {agent.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm sm:text-base font-bold text-text-primary">
                            {agent.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${getVerdictStyle(
                              agent.verdict
                            )}`}
                          >
                            {agent.verdict} ({agent.score}/10)
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-accent mt-0.5">
                          {agent.role}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-muted font-medium mt-2">
                    <strong>Odak:</strong> {agent.focus}
                  </p>
                </div>

                {/* Speech Bubble */}
                <div className="p-3.5 rounded-xl bg-bg-secondary/60 border border-border/80 text-xs sm:text-sm text-text-primary leading-relaxed relative">
                  <span className="text-accent font-serif text-lg leading-none absolute -top-2 left-3">
                    “
                  </span>
                  <p className="italic pl-2 pt-1">{agent.speech}</p>
                </div>

                {/* Key Arguments Bullet List */}
                <div className="space-y-1.5 pt-1 border-t border-border">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                    Temel Savlar & Gözlemler:
                  </span>
                  <ul className="space-y-1">
                    {agent.keyArguments.map((arg, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-text-secondary flex items-start gap-1.5"
                      >
                        {agent.id === 'burry' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        <span>{arg}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
