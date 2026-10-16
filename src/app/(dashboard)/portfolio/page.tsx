'use client';
import { Icon as UIIcon } from '@/components/ui/Icon';

import { palette } from '@/theme/palette';


import { CashPanel } from '@/components/portfolio/CashPanel';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioAllocationChart } from '@/components/portfolio/PortfolioAllocationChart';
import PortfolioHeatmap from '@/components/dashboard/PortfolioHeatmap';
import { DailyPnLCalendarHeatmap } from '@/components/portfolio/DailyPnLCalendarHeatmap';
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import { ExcelImportModal } from '@/components/portfolio/ExcelImportModal';
import { Badge, Button, Modal, Input, useToast, InstrumentLogo, StateView } from '@/components/ui';

export default function PortfolioPage() {
  const {
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    addPortfolio,
    deletePortfolio,
    clearPortfolioTransactions,
    transactions,
    deleteTransaction,
    getSummary,
    fetchPortfoliosAndTransactions,
    fetchLivePrices,
    isRefreshingPrices,
  } = usePortfolioStore();

  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; symbol: string } | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeModalSymbol, setTradeModalSymbol] = useState<string | undefined>(undefined);
  const [tradeModalMode, setTradeModalMode] = useState<'broker' | 'stock' | 'fund' | 'cash'>('broker');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isNewPortModalOpen, setIsNewPortModalOpen] = useState(false);
  const [isDeletePortModalOpen, setIsDeletePortModalOpen] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<(typeof portfolios)[0] | null>(null);
  const [isClearTxModalOpen, setIsClearTxModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newPortName, setNewPortName] = useState('');
  const [newPortDesc, setNewPortDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'holdings' | 'heatmap' | 'activity' | 'transactions'>('holdings');
  const [assetFilter, setAssetFilter] = useState<'all' | 'stock' | 'fund' | 'cash'>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  // Visibility-aware live price background refresh (OPS-01)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          fetchLivePrices();
        }
      }, 60000);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchLivePrices();
        startPolling();
      } else if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      startPolling();
    }

    return () => {
      if (interval) clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fetchLivePrices]);

  const summary = getSummary();
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];
  let activeTransactions = transactions.filter((t) => t.portfolioId === activePortfolioId);
  // Fallback if transaction portfolioId is slightly mismatched or only one portfolio exists
  if (activeTransactions.length === 0 && transactions.length > 0) {
    if (portfolios.length <= 1 || !portfolios.some((p) => transactions.some((t) => t.portfolioId === p.id))) {
      activeTransactions = transactions;
    }
  }

  const filteredTransactions = activeTransactions
    .filter((tx) => {
      if (txTypeFilter === 'buy' && tx.transactionType !== 'buy') return false;
      if (txTypeFilter === 'sell' && tx.transactionType !== 'sell') return false;
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase();
        const matchSymbol = tx.symbol.toLowerCase().includes(q);
        const matchNotes = (tx.notes || '').toLowerCase().includes(q);
        if (!matchSymbol && !matchNotes) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.transactionDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.transactionDate || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  const isProfit = summary.totalPnL >= 0;

  if (!isMounted) {
    return (
      <div className="space-y-6 animate-pulse pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-bg-card rounded-lg border border-border" />
            <div className="h-4 w-72 bg-bg-card rounded border border-border" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-28 bg-bg-card rounded-xl border border-border" />
            <div className="h-10 w-28 bg-bg-card rounded-xl border border-border" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-bg-card border border-border" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 rounded-2xl bg-bg-card border border-border" />
          <div className="lg:col-span-2 h-64 rounded-2xl bg-bg-card border border-border" />
        </div>
        <div className="h-96 rounded-2xl bg-bg-card border border-border" />
      </div>
    );
  }

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortName.trim()) return;
    const created = await addPortfolio(newPortName.trim(), newPortDesc.trim());
    if (created) {
      setActivePortfolioId(created.id);
    }
    showToast({
      type: 'success',
      title: 'Portföy Oluşturuldu',
      message: `"${newPortName}" portföyü başarıyla oluşturuldu.`,
    });
    setNewPortName('');
    setNewPortDesc('');
    setIsNewPortModalOpen(false);
  };

  const handleOpenDeletePortfolio = (p: (typeof portfolios)[0]) => {
    setDeleteConfirmed(false);
    setPortfolioToDelete(p);
    setIsDeletePortModalOpen(true);
  };

  const handleConfirmDeletePortfolio = async () => {
    if (!portfolioToDelete) return;
    if (!deleteConfirmed) { setDeleteConfirmed(true); return; }
    setIsDeleting(true);
    const name = portfolioToDelete.name;
    const success = await deletePortfolio(portfolioToDelete.id);
    setIsDeleting(false);
    setIsDeletePortModalOpen(false);
    setPortfolioToDelete(null);

    if (success) {
      showToast({
        type: 'info',
        title: 'Portföy Silindi',
        message: `"${name}" portföyü ve tüm verileri silindi.`,
      });
    } else {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: 'Portföy silinirken bir sorun oluştu.',
      });
    }
  };

  const handleConfirmClearTransactions = async () => {
    if (!activePortfolio) return;
    if (!clearConfirmed) { setClearConfirmed(true); return; }
    setIsDeleting(true);
    const success = await clearPortfolioTransactions(activePortfolio.id);
    setIsDeleting(false);
    setIsClearTxModalOpen(false);

    if (success) {
      showToast({
        type: 'info',
        title: 'İşlemler Temizlendi',
        message: `"${activePortfolio.name}" portföyündeki tüm işlem kayıtları temizlendi.`,
      });
    } else {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: 'İşlemler temizlenirken bir sorun oluştu.',
      });
    }
  };


  return (
    <div className="portfolio-page space-y-4 sm:space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto">
      <h1 className="sr-only">Portföy</h1>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-bg-primary/55 backdrop-blur-md rounded-xl border border-border/80 overflow-x-auto scrollbar-none w-full sm:w-auto">
            {portfolios.map((p) => {
              const isActive = activePortfolioId === p.id;
              return (
                <div
                  key={p.id}
                  className={`group relative flex items-center gap-1.5 pl-3 pr-0 py-0 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-accent text-white shadow'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <button
                    onClick={() => setActivePortfolioId(p.id)}
                    className="cursor-pointer"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDeletePortfolio(p);
                    }}
                    className={`p-0.5 rounded-md transition-colors cursor-pointer ${
                      isActive
                        ? 'text-white/70 hover:text-white hover:bg-white/20'
                        : 'text-text-muted hover:text-danger hover:bg-danger/10'
                    }`}
                    title={`"${p.name}" portföyünü sil`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setIsNewPortModalOpen(true)}
              className="p-1.5 text-text-muted hover:text-accent rounded-lg transition-colors cursor-pointer shrink-0"
              title="Yeni Portföy Oluştur"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

        <div className="grid grid-cols-2 gap-2 shrink-0">
          <Button size="sm" onClick={() => { setTradeModalSymbol(undefined); setTradeModalMode('broker'); setIsTradeModalOpen(true); }} leftIcon={<UIIcon name="plus" className="w-4 h-4" />}>İşlem Yap</Button>
          <Button variant="outline" size="sm" onClick={() => setIsExcelModalOpen(true)} leftIcon={<UIIcon name="download" className="w-4 h-4" />}>Excel Yükle</Button>
        </div>
      </div>

      {/* Valuation Warning Banner if any live prices are missing */}
      {summary.valuationStatus?.hasMissingPrices && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
          <span className="text-base shrink-0"><UIIcon name="warning" className="w-4 h-4" /></span>
          <span>Portföyünüzdeki bazı varlıkların canlı piyasa fiyatı alınamadı; değerleme son bilinen işlem maliyeti üzerinden gösteriliyor.</span>
        </div>
      )}

      {/* Summary KPI Cards - compact, mobile-first */}
      <div className="portfolio-metrics grid grid-cols-2 gap-2 sm:gap-3.5">
        {/* Total value and allocation share the same compact summary. */}
        <div className="portfolio-metric-card col-span-2 p-3 sm:p-4 flex items-center justify-between gap-3" style={{ '--metric-color': palette.primaryDark } as React.CSSProperties}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider">Portföy Değeri</p>
            <h2 className="text-xl sm:text-3xl font-black text-text-primary mt-1 font-mono tracking-tight truncate">₺{summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <p className="mt-2 text-xs text-text-muted">{summary.cash?.configured ? 'Net yatırılan' : 'Maliyet'}: ₺{summary.totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</p>
          </div>
          <PortfolioAllocationChart compact allocation={summary.allocation} totalValue={summary.totalValue} />
        </div>

        {/* Total PnL */}
        <div className="portfolio-metric-card min-h-[112px] p-3 sm:p-4 flex flex-col justify-between" style={{ '--metric-color': isProfit ? palette.success : palette.danger, '--metric-glow': isProfit ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)' } as React.CSSProperties}>
          <div>
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider">
              <span>Toplam Kâr/Zarar</span>
              <span className="text-base sm:text-lg">{isProfit ? "" : ""}</span>
            </div>
            <h3 className={`text-lg sm:text-2xl font-black mt-1 font-mono tracking-tight truncate ${isProfit ? 'text-success' : 'text-danger'}`}>
              {isProfit ? '+' : ''}₺{summary.totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              <Badge variant={isProfit ? 'success' : 'danger'} size="sm">
                {isProfit ? '+' : ''}{summary.totalPnLPercent.toFixed(2)}%
              </Badge>
              <span className="text-text-muted hidden sm:inline">net getiri</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted pt-1 border-t border-border/50">
              <span>Açık: <strong className={summary.unrealizedPnL >= 0 ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>₺{summary.unrealizedPnL.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
              {summary.realizedPnL !== 0 && (
                <span>Kapanan: <strong className={summary.realizedPnL >= 0 ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>₺{summary.realizedPnL.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Daily PnL & Position Count */}
        <div className="portfolio-metric-card min-h-[112px] p-3 sm:p-4 flex flex-col justify-between" style={{ '--metric-color': summary.dailyPnL >= 0 ? palette.success : palette.danger, '--metric-glow': summary.dailyPnL >= 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)' } as React.CSSProperties}>
          <div>
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider">
              <span>Günlük Getiri</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-bg-secondary text-text-muted border border-border/50">
                {summary.holdings.length} Poz.
              </span>
            </div>
            <h3 className={`text-lg sm:text-2xl font-black mt-1 font-mono tracking-tight truncate ${summary.dailyPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              {summary.dailyPnL >= 0 ? '+' : ''}₺{summary.dailyPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="flex items-center justify-between gap-1 mt-2 text-[10px] sm:text-xs">
            <Badge variant={summary.dailyPnLPercent >= 0 ? 'success' : 'danger'} size="sm">
              {summary.dailyPnLPercent >= 0 ? '+' : ''}{summary.dailyPnLPercent.toFixed(2)}%
            </Badge>
            <button
              type="button"
              onClick={() => {
                setActiveTab('activity');
                setTimeout(() => {
                  document.getElementById('daily-calendar')?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              className="text-[10px] sm:text-[11px] font-bold text-accent hover:underline flex items-center gap-0.5 transition-colors shrink-0 cursor-pointer"
              title="Günlük Kâr Aktivite Haritasına Git"
            >
              <span> Aktivite</span>
              <span>↓</span>
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted px-1">İşlem hacmi: ₺{summary.totalVolume.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} · Alış: ₺{summary.buyVolume.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} · Satış: ₺{summary.sellVolume.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
      <nav aria-label="Portföy varlık filtresi" className="grid grid-cols-4 gap-1.5">{([['all', 'Tümü'], ['stock', 'Hisse'], ['fund', 'Fon'], ['cash', 'Nakit']] as const).map(([key, label]) => <Button key={key} size="sm" variant={assetFilter === key ? 'primary' : 'secondary'} aria-pressed={assetFilter === key} onClick={() => setAssetFilter(key)}>{label}</Button>)}</nav>

      {assetFilter === 'cash' && <CashPanel />}
      {/* Tabs: Holdings vs Heatmap & Activity vs Transaction History */}
      <div className="space-y-4">
        {/* Navigation Tabs & Secondary Actions */}
        <div className="sm:sticky sm:top-[4.25rem] z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 sm:p-2.5 rounded-2xl bg-bg-primary/90 backdrop-blur-xl border border-border/80 shadow-sm">
          <div role="tablist" aria-label="Portföy bölümleri" className="grid grid-cols-4 gap-1 w-full">
            {([['holdings', 'Varlıklar'], ['heatmap', 'Isı Haritası'], ['activity', 'Aktivite'], ['transactions', 'İşlemler']] as const).map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`min-w-0 min-h-11 px-1 rounded-lg text-[11px] sm:text-sm font-semibold ${activeTab === tab ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-secondary'}`}>{label}</button>)}
          </div>

          {activeTab === 'transactions' && activeTransactions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setClearConfirmed(false); setIsClearTxModalOpen(true); }}
                className="text-xs border-red-500/30 text-rose-400 hover:bg-red-500/10 hover:border-red-500 flex-1 sm:flex-none justify-center"
                leftIcon={
                  <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
              >
                İşlemleri Temizle
              </Button>

            </div>
          )}
        </div>

        {activeTab === 'holdings' ? (assetFilter === 'cash' ? <StateView title="Nakit hareketleri" description="Bakiyelerinizi ve para giriş/çıkış geçmişinizi Nakit Hesabı bölümünden yönetin." /> :
          <HoldingsTable
            holdings={summary.holdings.filter((h) => assetFilter === 'all' || h.assetType === assetFilter)}
            onAddTransaction={() => {
              setTradeModalSymbol(undefined);
              setTradeModalMode('stock');
              setIsTradeModalOpen(true);
            }}
            onTrade={(sym) => {
              setTradeModalSymbol(sym);
              setTradeModalMode('broker');
              setIsTradeModalOpen(true);
            }}
          />
        ) : activeTab === 'heatmap' ? (
          <PortfolioHeatmap />
        ) : activeTab === 'activity' ? (
          <div id="daily-calendar" className="min-w-0 scroll-mt-28"><DailyPnLCalendarHeatmap portfolioId={activePortfolioId} summary={summary} transactions={activeTransactions} /></div>
        ) : (
          /* Transaction History Section (Mobile Card View + Desktop Table View) */
          <div className="space-y-4">
            {/* Filter and Search Bar for Transactions */}
            {activeTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-bg-card border border-border shadow-xs">
                {/* Type Filter Pills */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-secondary/70 border border-border/60 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      txTypeFilter === 'all'
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Tümü ({activeTransactions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('buy')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      txTypeFilter === 'buy'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    Alış ({activeTransactions.filter((t) => t.transactionType === 'buy').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('sell')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      txTypeFilter === 'sell'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-rose-400 hover:bg-rose-500/10'
                    }`}
                  >
                    Satış ({activeTransactions.filter((t) => t.transactionType === 'sell').length})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 sm:max-w-xs">
                  <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={txSearchQuery}
                    onChange={(e) => setTxSearchQuery(e.target.value)}
                    placeholder="Sembol veya not ara..."
                    className="w-full pl-9 pr-7 py-1.5 rounded-xl text-xs bg-bg-secondary border border-border/60 text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-accent"
                  />
                  {txSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTxSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════
                MOBILE CARD VIEW (md:hidden) — Touch-friendly, clean & compact
                ═══════════════════════════════════════════ */}
            <div className="md:hidden space-y-2.5">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-bg-card border border-border text-xs text-text-muted space-y-2">
                  <p>
                    {activeTransactions.length === 0
                      ? 'Bu portföyde henüz işlem kaydı bulunmuyor.'
                      : 'Filtreye uygun işlem bulunamadı.'}
                  </p>
                  {activeTransactions.length === 0 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => setIsExcelModalOpen(true)}>
                        Excel / CSV İle Yükle
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => setIsTradeModalOpen(true)}>
                        Manuel İşlem Ekle
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const isBuy = tx.transactionType === 'buy';
                  const total = tx.quantity * tx.price + (tx.commission || 0);

                  return (
                    <div
                      key={`m-tx-${tx.id}`}
                      className="p-3.5 rounded-2xl bg-bg-card border border-border/80 shadow-xs hover:border-accent/40 transition-all flex flex-col gap-2.5"
                    >
                      {/* Top Row: Symbol, Badge, Date & Delete */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <InstrumentLogo symbol={tx.symbol} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-text-primary font-mono tracking-tight">
                                {tx.symbol}
                              </span>
                              <Badge variant={isBuy ? 'success' : 'danger'} size="sm">
                                {isBuy ? 'ALIŞ' : 'SATIŞ'}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-text-muted font-mono mt-0.5 block">
                              {tx.transactionDate}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget({ id: tx.id, symbol: tx.symbol });
                          }}
                          className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/20 transition-colors cursor-pointer"
                          title="İşlemi Sil"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Middle: Details Box */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-bg-secondary/60 border border-border/50 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-text-muted font-sans block">Adet & Fiyat</span>
                          <span className="font-semibold text-text-primary mt-0.5 block">
                            {tx.quantity.toLocaleString('tr-TR')} adet × ₺{tx.price.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-text-muted font-sans block">Toplam Tutar</span>
                          <span className={`font-bold mt-0.5 block ${isBuy ? 'text-text-primary' : 'text-emerald-400'}`}>
                            ₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Footer: Notes / Commission if any */}
                      {(tx.notes || (tx.commission != null && tx.commission > 0)) && (
                        <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40">
                          {tx.notes ? (
                            <span className="italic truncate max-w-[200px]">
                               {tx.notes}
                            </span>
                          ) : <span />}
                          {tx.commission != null && tx.commission > 0 && (
                            <span className="font-mono text-[10px] text-text-muted shrink-0">
                              Komisyon: ₺{tx.commission.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ═══════════════════════════════════════════
                DESKTOP TABLE VIEW (hidden md:block) — Comprehensive full width
                ═══════════════════════════════════════════ */}
            <div className="hidden md:block rounded-2xl bg-bg-card border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-secondary text-text-secondary text-xs uppercase font-semibold border-b border-border">
                    <tr>
                      <th className="py-3.5 px-4">Tarih</th>
                      <th className="py-3.5 px-4">Sembol</th>
                      <th className="py-3.5 px-4">Tür</th>
                      <th className="py-3.5 px-4 text-right">Adet</th>
                      <th className="py-3.5 px-4 text-right">Birim Fiyat</th>
                      <th className="py-3.5 px-4 text-right">Toplam Tutar</th>
                      <th className="py-3.5 px-4">Notlar</th>
                      <th className="py-3.5 px-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-text-muted">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <svg className="w-8 h-8 text-text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p>
                              {activeTransactions.length === 0
                                ? 'Bu portföyde henüz işlem kaydı bulunmuyor.'
                                : 'Filtreye uygun işlem bulunamadı.'}
                            </p>
                            {activeTransactions.length === 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                <Button size="sm" variant="outline" onClick={() => setIsExcelModalOpen(true)}>
                                  Excel / CSV İle Yükle
                                </Button>
                                <Button size="sm" variant="primary" onClick={() => setIsTradeModalOpen(true)}>
                                  Manuel İşlem Ekle
                                </Button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-bg-hover transition-colors">
                          <td className="py-3.5 px-4 font-mono text-text-secondary">
                            {tx.transactionDate}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-text-primary">
                            <div className="flex items-center gap-2">
                              <InstrumentLogo symbol={tx.symbol} size="sm" />
                              <span>{tx.symbol}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant={tx.transactionType === 'buy' ? 'success' : 'danger'} size="sm">
                              {tx.transactionType === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-text-primary">
                            {tx.quantity.toLocaleString('tr-TR')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-text-secondary">
                            ₺{tx.price.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                            ₺{(tx.quantity * tx.price + (tx.commission || 0)).toLocaleString('tr-TR', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-text-muted">
                            {tx.notes || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget({ id: tx.id, symbol: tx.symbol });
                              }}
                              className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                              title="İşlemi Sil"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && <ConfirmAction key={deleteTarget.id} title="İşlemi Sil" description={`${deleteTarget.symbol} işlem kaydı kalıcı olarak silinecek.`} onClose={() => setDeleteTarget(null)} onConfirm={async () => { return await deleteTransaction(deleteTarget.id); }} />}
      {/* Manual & Brokerage Transaction Modal */}
      <TransactionModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        initialSymbol={tradeModalSymbol}
        initialMode={tradeModalMode}
      />

      {/* Excel / CSV Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
      />

      {/* New Portfolio Modal */}
      <Modal
        isOpen={isNewPortModalOpen}
        onClose={() => setIsNewPortModalOpen(false)}
        title="Yeni Portföy Oluştur"
        description="Farklı stratejiler için ayrı portföyler oluşturabilirsiniz."
      >
        <form onSubmit={handleCreatePortfolio} className="space-y-4">
          <Input
            label="Portföy Adı"
            placeholder="örn: ABD Büyüme Hisseleri"
            value={newPortName}
            onChange={(e) => setNewPortName(e.target.value)}
            required
          />
          <Input
            label="Açıklama (Opsiyonel)"
            placeholder="örn: 5 yıllık uzun vadeli teknoloji yatırımları"
            value={newPortDesc}
            onChange={(e) => setNewPortDesc(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsNewPortModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit" variant="primary">
              Oluştur
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Portfolio Confirmation Modal */}
      <Modal
        isOpen={isDeletePortModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeletePortModalOpen(false);
            setPortfolioToDelete(null);
          }
        }}
        title="Portföyü Sil"
        description="Bu işlem portföyü ve içindeki tüm verileri silecektir."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-3">
            <svg className="w-6 h-6 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-text-primary">
                "{portfolioToDelete?.name}" portföyünü silmek istediğinize emin misiniz?
              </p>
              <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                Bu portföye ait{' '}
                <span className="font-semibold text-danger">
                  {transactions.filter((t) => t.portfolioId === portfolioToDelete?.id).length} adet işlem kaydı
                </span>{' '}
                ve tüm varlık dökümü kalıcı olarak silinecektir. Bu işlem geri alınamaz.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setIsDeletePortModalOpen(false);
                setPortfolioToDelete(null);
              }}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isDeleting}
              onClick={handleConfirmDeletePortfolio}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {isDeleting ? 'Siliniyor...' : deleteConfirmed ? 'Son Onay: Kalıcı Olarak Sil' : 'Devam Et'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear All Transactions Confirmation Modal */}
      <Modal
        isOpen={isClearTxModalOpen}
        onClose={() => {
          if (!isDeleting) setIsClearTxModalOpen(false);
        }}
        title="Tüm İşlemleri Temizle"
        description="Bu portföydeki bütün alım/satım kayıtları silinecektir."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-text-primary">
                "{activePortfolio?.name}" portföyündeki {activeTransactions.length} işlem temizlensin mi?
              </p>
              <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                Portföy adı korunacak, ancak portföy içerisindeki tüm alım ve satım kayıtları sıfırlanacaktır.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setIsClearTxModalOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isDeleting}
              onClick={handleConfirmClearTransactions}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {isDeleting ? 'Temizleniyor...' : clearConfirmed ? 'Son Onay: Tüm İşlemleri Sil' : 'Devam Et'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
