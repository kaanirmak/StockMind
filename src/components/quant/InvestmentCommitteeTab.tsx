'use client';
import QuantSymbolSelect from './QuantSymbolSelect';
import QuantProfileBanner from './QuantProfileBanner';

import React, { useState, useEffect, useRef } from 'react';
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
  buildCommitteeEvidencePacket,
  type CommitteeReport,
} from '@/lib/ai/investment-committee';
import { getFinancialProfile } from '@/lib/quant/models';
import { useAuth } from '@/hooks/useAuth';
import { Holding } from '@/types/portfolio';
import { getStoredOpenRouterKey, saveStoredOpenRouterKey } from '@/lib/ai/apiKeyStorage';
import { Button } from '@/components/ui/Button';
import { ProRequestModal } from '@/components/pro/ProRequestModal';
import { ProScopeAndSamplePreview } from '@/components/pro/ProScopeAndSamplePreview';
import { hasProAccess } from '@/lib/ai/modelCatalog';
import {
  buildSavedReportFromCommittee,
  deleteSavedAnalysisReport,
  listSavedAnalysisReports,
  saveAnalysisReport,
  type SavedAnalysisReport,
} from '@/lib/ai/savedReports';

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
  const { user, profile } = useAuth();
  const isUserPro = Boolean(profile?.isPro || (user?.app_metadata && hasProAccess(user.app_metadata)));
  const initialSym = selectedSymbol || portfolioStocks[0]?.symbol || 'THYAO';
  const [symbol, setSymbol] = useState(initialSym);
  const [customInput, setCustomInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<CommitteeReport | null>(null);
  const [customApiKey, setCustomApiKey] = useState('');
  const [deliberationStep, setDeliberationStep] = useState(0);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');
  const [showProModal, setShowProModal] = useState(false);
  const [isProRequired, setIsProRequired] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [wasCancelled, setWasCancelled] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedAnalysisReport<CommitteeReport>[]>([]);
  const [saveFeedback, setSaveFeedback] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const cancelReasonRef = useRef<'none' | 'timeout' | 'user' | 'superseded'>('none');

  const DELIBERATION_STEPS = [
    'Komite üyeleri toplanıyor...',
    'Warren Buffett: Ekonomik hendek ve serbest nakit akışını inceliyor...',
    'Peter Lynch: Büyüme hikayesi ve PEG oranını hesaplıyor...',
    'Jim Simons: Algoritmik momentum ve volatilite sinyallerini tarıyor...',
    'Michael Burry: Makro kırılganlık ve ayı tezlerini oluşturuyor...',
    'Yatırım Komitesi Konsensüs Raporu sentezleniyor...',
  ];

  useEffect(() => {
    const refreshSaved = () => {
      const all = listSavedAnalysisReports<CommitteeReport>(undefined, user?.id).filter(
        (r) => r.kind === 'investment_committee' && Boolean(r.committeeSnapshot)
      );
      setSavedReports(all);
    };
    refreshSaved();
  }, [user?.id]);

  // Load API key from settings and listen to updates
  useEffect(() => {
    const key = getStoredOpenRouterKey(user?.id);
    setCustomApiKey(key);

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

  // Sync external selectedSymbol changes without auto-triggering a paid/network analysis (QNT-04)
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      cancelReasonRef.current = 'superseded';
      activeRequest.current?.abort();
      activeRequest.current = null;
      setIsLoading(false);
      setSymbol(selectedSymbol);
      setReport(null);
      setAnalysisError('');
      setWasCancelled(false);
    }
  }, [selectedSymbol]);

  // Abort any in-flight committee call only on unmount; never auto-start on screen entry (QNT-04).
  useEffect(() => {
    return () => {
      cancelReasonRef.current = 'superseded';
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const handleCancelCommittee = () => {
    if (!activeRequest.current) return;
    cancelReasonRef.current = 'user';
    activeRequest.current.abort();
    activeRequest.current = null;
    setIsLoading(false);
    setDeliberationStep(0);
    setWasCancelled(true);
    setAnalysisError('Komite analizi kullanıcı tarafından iptal edildi.');
  };

  const executeCommittee = async (targetSymbol: string) => {
    const cleanSym = targetSymbol.trim().toUpperCase();
    if (!cleanSym) return;

    cancelReasonRef.current = 'superseded';
    activeRequest.current?.abort();
    const controller = new AbortController();
    cancelReasonRef.current = 'none';
    activeRequest.current = controller;
    setIsLoading(true);
    setReport(null);
    setAnalysisError('');
    setWasCancelled(false);
    setDeliberationStep(0);

    // Synchronously resolve key from memory or storage
    const activeKey = (customApiKey || getStoredOpenRouterKey(user?.id) || '').trim() || undefined;
    if (activeKey && !customApiKey) {
      setCustomApiKey(activeKey);
    }

    // Simulate deliberation progress steps for UI feedback
    const interval = setInterval(() => {
      setDeliberationStep((prev) => Math.min(prev + 1, DELIBERATION_STEPS.length - 1));
    }, 1600);
    const timeout = setTimeout(() => {
      cancelReasonRef.current = 'timeout';
      controller.abort();
    }, 50_000);
    controller.signal.addEventListener('abort', () => {
      clearInterval(interval);
      clearTimeout(timeout);
    }, { once: true });

    try {
      const res = await fetch('/api/quant/committee', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: cleanSym,
          apiKey: activeKey,
        }),
      });

      const data = await res.json();
      if (activeRequest.current !== controller) return;
      if (data.code === 'PRO_REQUIRED') {
        setIsProRequired(true);
        setReport(null);
        return;
      }

      if (res.ok && data.success && data.report?.symbol === cleanSym) {
        setIsProRequired(false);
        setReport(data.report);
      } else {
        throw new Error(data.error || 'Komite analizi alınamadı. Lütfen tekrar deneyin.');
      }
    } catch (e) {
      const cancelReason = cancelReasonRef.current as 'none' | 'timeout' | 'user' | 'superseded';
      if (cancelReason === 'user') return;
      if (activeRequest.current !== controller) return;
      setReport(null);
      setAnalysisError(
        cancelReason === 'timeout'
          ? 'Komite yanıtı zaman aşımına uğradı. Tekrar deneyin.'
          : e instanceof Error
            ? e.message
            : 'Komite servisine ulaşılamadı.'
      );
    } finally {
      clearTimeout(timeout);
      clearInterval(interval);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsLoading(false);
        setDeliberationStep(0);
      }
    }
  };

  const handleSelectSymbol = (sym: string) => {
    cancelReasonRef.current = 'superseded';
    activeRequest.current?.abort();
    activeRequest.current = null;
    setIsLoading(false);
    setSymbol(sym);
    setCustomInput('');
    setReport(null);
    setAnalysisError('');
    setWasCancelled(false);
    onSelectSymbol?.(sym);
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

  const activeHolding = portfolioStocks.find(
    (h) => h.symbol.toUpperCase() === symbol.trim().toUpperCase()
  );
  const holdingPrice = activeHolding?.originalPrice ?? activeHolding?.currentPrice;
  const quantProfile = getFinancialProfile(symbol, holdingPrice);

  return (
    <div className="space-y-6">
      <QuantProfileBanner
        symbol={symbol}
        meta={quantProfile.profileMeta}
        committeeModeNote={
          report?.isLiveLLM
            ? 'Yatırım Komitesi sunucudan alınan canlı piyasa fiyatını kullanır; finansal tablo oranları bağlı değilse örnek/model varsayımlarına dayanır.'
            : quantProfile.profileMeta.summary
        }
      />
      {report && !report.isLiveLLM && (
        <p className="rounded-xl border border-warning/30 p-3 text-sm text-text-secondary">
          AI yanıtı alınamadı. Bu örnek senaryodaki görüşler ve sayılar model varsayımlarına dayanır.
        </p>
      )}
      {analysisError && (
        <div
          role="alert"
          data-testid="committee-error-state"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-text-primary"
        >
          <span>{analysisError}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              data-testid="committee-retry-button"
              onClick={() => executeCommittee(symbol)}
            >
              {wasCancelled ? 'Yeniden Başlat' : 'Yeniden Dene'}
            </Button>
          </div>
        </div>
      )}
      {/* Symbol selection and committee settings */}
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

        </div>

        <div className="mt-4 border-t border-border pt-3 space-y-3">
          <QuantSymbolSelect
            value={symbol}
            onChange={handleSelectSymbol}
            portfolioStocks={portfolioStocks}
            fallbackSymbols={POPULAR_SYMBOLS.map((item) => item.symbol)}
          />
          <div data-testid="committee-action-bar" className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-text-muted">
              Seçili sembol: <strong className="text-text-primary">{symbol}</strong> — analiz yalnız siz başlattığınızda çalışır.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {isLoading ? (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  data-testid="committee-cancel-button"
                  onClick={handleCancelCommittee}
                >
                  Analizi İptal Et
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  data-testid="committee-run-button"
                  onClick={() => executeCommittee(symbol)}
                >
                  {report ? 'Komiteyi Yeniden Topla' : 'Komite Analizini Başlat'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <details className="mt-3 rounded-xl border border-border p-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-text-secondary">Farklı sembol gir</summary>
          <div className="mt-2">
            <form onSubmit={handleCustomSubmit} className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  aria-label="Farklı bir hisse sembolü"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Sembol örn. THYAO..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="min-h-11 w-full sm:w-44 px-3 py-2 text-base sm:text-sm font-semibold rounded-xl bg-bg-input border border-border text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="min-h-11 justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-accent/20"
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
        </details>

        {/* API Key Status Notice */}
        {customApiKey ? (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Canlı LLM Münazarası Aktif:</strong> OpenRouter AI anahtarınız devrede ({customApiKey.slice(0, 6)}...{customApiKey.slice(-4)}). Komite üyeleri canlı yapay zeka ile tartışıyor.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTempKeyInput(customApiKey);
                setShowKeyModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Yönet / Değiştir</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-500">
              <Key className="w-4 h-4 shrink-0" />
              <span>
                <strong>Analitik Quant Simülasyonu Aktif:</strong> Canlı derin LLM münazarası için OpenRouter API anahtarınızı tanımlayabilirsiniz.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTempKeyInput(customApiKey);
                setShowKeyModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-semibold text-[11px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Key Tanımla</span>
              <Key className="w-3 h-3" />
            </button>
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
          <div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              data-testid="committee-loading-cancel-button"
              onClick={handleCancelCommittee}
            >
              İptal Et
            </Button>
          </div>
        </div>
      )}

      {/* Idle Prompt-to-Run State (no automatic API call on screen entry per QNT-04) */}
      {!isLoading && !report && !analysisError && !isProRequired && isUserPro && (
        <div
          data-testid="committee-idle-state"
          className="glass-card p-6 rounded-2xl border border-border text-center space-y-3"
        >
          <h3 className="text-base font-bold text-text-primary">
            {symbol} Komite Analizine Hazır
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Ekrana girildiğinde otomatik analiz veya yapay zekâ çağrısı yapılmaz. Komite değerlendirmesini başlatmak için aşağıdaki düğmeyi kullanın.
          </p>
          <div className="pt-1">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => executeCommittee(symbol)}
            >
              {symbol} İçin Komite Analizini Başlat
            </Button>
          </div>
        </div>
      )}

      {/* Pro Gate Banner (when not Pro or Pro is required) */}
      {!isLoading && !report && (isProRequired || !isUserPro) && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-bg-card to-bg-card text-center space-y-4 shadow-xl animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-amber-500/25">
            ⭐
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h3 className="text-lg sm:text-xl font-bold text-text-primary">
              Yatırım Komitesi StockMind Pro Özelliğidir
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              4 Efsane fon yöneticisi (Warren Buffett, Peter Lynch, Jim Simons, Michael Burry) çoklu yapay zeka simülasyonu ve konsensüs analiz motoru yalnızca Pro hesaplara açıktır.
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => setShowProModal(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-6 py-2.5 shadow-lg shadow-amber-500/20 text-xs sm:text-sm"
            >
              🚀 Pro Hesap İste ve Erişimi Aç
            </Button>
          </div>
          <div className="max-w-2xl mx-auto pt-2">
            <ProScopeAndSamplePreview compact />
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
                    {report.isLiveLLM ? 'AI komite simülasyonu' : 'Örnek senaryo'}
                  </span>
                  <button
                    type="button"
                    data-testid="committee-save-report-btn"
                    onClick={() => {
                      saveAnalysisReport(
                        buildSavedReportFromCommittee({
                          report,
                          assumptions: report.evidence?.assumptions ?? [
                            'Seçili sembol için sunucudan alınan son kotasyon kullanıldı.',
                          ],
                        }),
                        undefined,
                        user?.id
                      );
                      setSavedReports(
                        listSavedAnalysisReports<CommitteeReport>(undefined, user?.id).filter(
                          (r) => r.kind === 'investment_committee' && Boolean(r.committeeSnapshot)
                        )
                      );
                      setSaveFeedback('Rapor kaydedildi');
                      setTimeout(() => setSaveFeedback(''), 2500);
                    }}
                    className="text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold hover:bg-emerald-500/20 cursor-pointer"
                  >
                    {saveFeedback || 'Raporu Kaydet'}
                  </button>
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

          {/* Evidence, Market vs Financial Data, Assumptions & Missing Data vs Sample Framing (QNT-12) */}
          {(() => {
            const evidence =
              report.evidence ??
              buildCommitteeEvidencePacket({
                symbol: report.symbol,
                isLiveLLM: report.isLiveLLM,
              });
            return (
              <div
                data-testid="committee-evidence-panel"
                className="glass-card p-5 rounded-2xl border border-border space-y-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/70">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-text-primary">
                      Komite Kararının Dayandığı Kanıtlar, Varsayımlar ve Veri Kapsamı
                    </h4>
                    <p className="text-[11px] text-text-muted">
                      Kullanılan doğrulanmış veriler ile model varsayımları ve eksik girdiler ayrı gösterilir.
                    </p>
                  </div>
                  <span
                    data-testid="committee-evidence-basis"
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                      evidence.isSampleOrSimulation
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {evidence.dataBasisBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Piyasa Verileri */}
                  <div className="p-3.5 rounded-xl bg-bg-secondary/45 border border-border/70 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-primary block">
                      Kullanılan Piyasa Verileri
                    </span>
                    {evidence.marketData.length > 0 ? (
                      <ul className="space-y-1">
                        {evidence.marketData.map((m, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-text-secondary">{m.label}:</span>
                            <span className="font-mono font-bold text-text-primary">
                              {m.value}{' '}
                              <span className="font-normal text-text-muted">({m.source})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-amber-400">
                        Doğrulanmış canlı piyasa kotasyonu bulunamadı.
                      </p>
                    )}
                  </div>

                  {/* Finansal Veriler */}
                  <div className="p-3.5 rounded-xl bg-bg-secondary/45 border border-border/70 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-primary block">
                      Kullanılan Finansal Veriler
                    </span>
                    {evidence.financialData.length > 0 ? (
                      <ul className="space-y-1">
                        {evidence.financialData.map((f, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-text-secondary">{f.label}:</span>
                            <span className="font-mono font-bold text-text-primary">
                              {f.value}{' '}
                              <span className="font-normal text-text-muted">({f.source})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-text-muted">
                        Bu komite çağrısında ayrıntılı bilanço/nakit akış verisi yer almıyor.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Varsayımlar */}
                  <div className="p-3.5 rounded-xl bg-bg-secondary/40 border border-border/70 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
                      Model &amp; Analiz Varsayımları
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-text-secondary">
                      {evidence.assumptions.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Eksik Veri vs Örnek Ayrımı */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                      Eksik Veriler &amp; Örnek / Simülasyon Ayrımı
                    </span>
                    {evidence.missingData.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-200/90">
                        {evidence.missingData.map((d, idx) => (
                          <li key={idx}>{d}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-emerald-300">
                        Tüm temel piyasa ve canlı AI girdileri eksiksiz doğrulandı.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-md w-full p-5 sm:p-6 border border-border rounded-2xl shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Quant Lab API Anahtarı</h3>
                  <p className="text-[11px] text-text-muted">Canlı yapay zeka yatırım komitesi münazarası</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="committee-openrouter-api-key" className="text-xs font-semibold text-text-secondary">OpenRouter API Anahtarı</label>
              <input
                id="committee-openrouter-api-key"
                type="password"
                aria-label="OpenRouter API Anahtarı"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx..."
                className="w-full bg-bg-input text-text-primary text-xs rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none font-mono"
              />
              <p className="text-[11px] text-text-muted">
                Anahtarınız güvenle tarayıcınızda ve hesabınızda saklanır. Tanımlandığında komite üyeleri (Buffett, Lynch, Simons, Burry) şirketi canlı derin LLM ile analiz eder.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {customApiKey ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomApiKey('');
                    setTempKeyInput('');
                    saveStoredOpenRouterKey('', user?.id);
                    setShowKeyModal(false);
                  }}
                  className="text-xs text-rose-400 hover:underline cursor-pointer font-medium"
                >
                  Anahtarı Kaldır
                </button>
              ) : (
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  <span>Ücretsiz Key Al</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowKeyModal(false)}>
                  İptal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const clean = tempKeyInput.trim();
                    setCustomApiKey(clean);
                    saveStoredOpenRouterKey(clean, user?.id);
                    setShowKeyModal(false);
                    executeCommittee(symbol);
                  }}
                >
                  Kaydet ve Başlat
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {savedReports.length > 0 && (
        <div
          data-testid="committee-saved-reports"
          className="glass-card p-4 rounded-2xl border border-border/70 space-y-2.5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-text-primary">
              Kayıtlı Komite Raporları ({savedReports.length})
            </span>
            <span className="text-[11px] text-text-muted">
              Sembol, veri tarihi, model ve varsayımlarla saklanır
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {savedReports.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border/60 bg-bg-secondary/50 p-2.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-text-primary truncate">{item.title}</span>
                  <span className="text-[10px] text-text-muted font-mono shrink-0">
                    {new Date(item.dataDate).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted truncate">
                  Model: {item.model} • Varsayım: {item.assumptions[0] || 'Standart'}
                </p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.committeeSnapshot) {
                        setSymbol(item.symbol);
                        setReport(item.committeeSnapshot);
                      }
                    }}
                    className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                  >
                    Raporu Yeniden Aç
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = deleteSavedAnalysisReport(item.id, undefined, user?.id).filter(
                        (r): r is SavedAnalysisReport<CommitteeReport> =>
                          r.kind === 'investment_committee' && Boolean(r.committeeSnapshot)
                      );
                      setSavedReports(next);
                    }}
                    className="text-[11px] text-danger hover:underline cursor-pointer"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ProRequestModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        userEmail={user?.email}
        userName={profile?.fullName || user?.user_metadata?.full_name}
        onSuccess={() => {
          setIsProRequired(false);
        }}
      />
    </div>
  );
}
