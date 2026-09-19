'use client';

import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioAllocationChart } from '@/components/portfolio/PortfolioAllocationChart';
import PortfolioHeatmap from '@/components/dashboard/PortfolioHeatmap';
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import { ExcelImportModal } from '@/components/portfolio/ExcelImportModal';
import { Badge, Button, Modal, Input, useToast } from '@/components/ui';
import { exportTransactionsToExcel, downloadExcelTemplate } from '@/lib/portfolio/excelParser';

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
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isNewPortModalOpen, setIsNewPortModalOpen] = useState(false);
  const [isDeletePortModalOpen, setIsDeletePortModalOpen] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<(typeof portfolios)[0] | null>(null);
  const [isClearTxModalOpen, setIsClearTxModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newPortName, setNewPortName] = useState('');
  const [newPortDesc, setNewPortDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'holdings' | 'heatmap' | 'transactions'>('holdings');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  const summary = getSummary();
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];
  const activeTransactions = transactions.filter((t) => t.portfolioId === activePortfolioId);

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

  const handleRefreshPrices = async () => {
    await fetchLivePrices();
    showToast({
      type: 'info',
      title: 'Fiyatlar Güncellendi',
      message: 'Tüm varlıkların anlık piyasa fiyatları güncellendi.',
    });
  };

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
    setPortfolioToDelete(p);
    setIsDeletePortModalOpen(true);
  };

  const handleConfirmDeletePortfolio = async () => {
    if (!portfolioToDelete) return;
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

  const handleExportCSV = () => {
    if (summary.holdings.length === 0) {
      showToast({ type: 'warning', title: 'Veri Yok', message: 'Dışa aktarılacak varlık bulunmuyor.' });
      return;
    }

    const headers = 'Sembol,Varlık Türü,Adet,Ortalama Maliyet,Son Fiyat,Toplam Maliyet,Piyasa Değeri,Kar Zarar,Kar Zarar Yüzdesi,Ağırlık\n';
    const rows = summary.holdings
      .map(
        (h) =>
          `${h.symbol},${h.assetType},${h.totalQuantity},${h.averageCost},${h.currentPrice},${h.totalCost},${h.currentValue},${h.pnl},${h.pnlPercent}%,%${h.weight}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activePortfolio?.name || 'Portfoy'}_varliklar.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({ type: 'success', title: 'CSV İndirildi', message: 'Portföy varlıkları CSV olarak kaydedildi.' });
  };

  const handleExportExcel = () => {
    if (activeTransactions.length === 0) {
      showToast({ type: 'warning', title: 'Veri Yok', message: 'Dışa aktarılacak işlem bulunmuyor.' });
      return;
    }
    exportTransactionsToExcel(activeTransactions, activePortfolio?.name || 'Portfoy');
    showToast({ type: 'success', title: 'Excel İndirildi', message: 'İşlemler Excel (.xlsx) olarak kaydedildi.' });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Portfolio Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Portföy Yönetimi</h1>
          <p className="text-text-secondary text-sm mt-1">
            Varlıklarınızı, maliyetlerinizi, anlık kar/zararınızı ve toplam işlem hacminizi yönetin.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Portfolio Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border">
            {portfolios.map((p) => {
              const isActive = activePortfolioId === p.id;
              return (
                <div
                  key={p.id}
                  className={`group relative flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
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
              className="p-1.5 text-text-muted hover:text-accent rounded-lg transition-colors cursor-pointer"
              title="Yeni Portföy Oluştur"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Delete Active Portfolio Button */}
          <Button
            variant="outline"
            size="md"
            onClick={() => handleOpenDeletePortfolio(activePortfolio)}
            className="border-red-500/30 text-rose-400 hover:bg-red-500/10 hover:border-red-500"
            title={`"${activePortfolio?.name}" portföyünü sil`}
            leftIcon={
              <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            }
          >
            Portföyü Sil
          </Button>

          {/* Live Price Refresh Button */}
          <Button
            variant="outline"
            size="md"
            onClick={handleRefreshPrices}
            disabled={isRefreshingPrices}
            title="Anlık Canlı Fiyatları Yenile"
            leftIcon={
              <svg
                className={`w-4 h-4 text-accent ${isRefreshingPrices ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            {isRefreshingPrices ? 'Fiyatlar Güncelleniyor...' : 'Fiyatları Yenile'}
          </Button>

          {/* Excel Upload Button */}
          <Button
            variant="outline"
            size="md"
            onClick={() => setIsExcelModalOpen(true)}
            className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500"
            leftIcon={
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            Excel Yükle
          </Button>

          {/* Export Options */}
          <Button
            variant="secondary"
            size="md"
            onClick={activeTab === 'transactions' ? handleExportExcel : handleExportCSV}
            leftIcon={
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          >
            {activeTab === 'transactions' ? 'Excel İndir' : 'CSV İndir'}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsTradeModalOpen(true)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            İşlem Ekle
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Toplam Portföy Değeri</p>
          <h3 className="text-2xl font-black text-text-primary mt-1 font-mono">
            ₺{summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-text-muted">
            <span>Toplam Maliyet:</span>
            <span className="font-semibold text-text-secondary">₺{summary.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Total PnL */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Toplam Kar / Zarar</p>
          <h3 className={`text-2xl font-black mt-1 font-mono flex items-center gap-1 ${isProfit ? 'text-success' : 'text-danger'}`}>
            <span>{isProfit ? '+' : ''}₺{summary.totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <Badge variant={isProfit ? 'success' : 'danger'} size="sm">
              {isProfit ? '+' : ''}{summary.totalPnLPercent.toFixed(2)}%
            </Badge>
            <span className="text-text-muted">tüm zamanlar</span>
          </div>
        </div>

        {/* Total Turnover / Volume */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Toplam İşlem Hacmi</p>
          <h3 className="text-2xl font-black text-text-primary mt-1 font-mono">
            ₺{summary.totalVolume.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
            <span className="text-emerald-400 font-medium">
              Alış: ₺{summary.buyVolume.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </span>
            <span>•</span>
            <span className="text-rose-400 font-medium">
              Satış: ₺{summary.sellVolume.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Daily PnL & Position Count */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Günlük Değişim</p>
            <span className="text-[11px] font-semibold text-text-muted">{summary.holdings.length} Pozisyon</span>
          </div>
          <h3 className={`text-2xl font-black mt-1 font-mono ${summary.dailyPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {summary.dailyPnL >= 0 ? '+' : ''}₺{summary.dailyPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <Badge variant={summary.dailyPnLPercent >= 0 ? 'success' : 'danger'} size="sm">
              {summary.dailyPnLPercent >= 0 ? '+' : ''}{summary.dailyPnLPercent.toFixed(2)}%
            </Badge>
            <span className="text-text-muted">bugün • {activeTransactions.length} işlem</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Allocation Chart & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <PortfolioAllocationChart allocation={summary.allocation} totalValue={summary.totalValue} />
        </div>

        <div className="lg:col-span-7 flex flex-col justify-between p-6 rounded-2xl bg-bg-card border border-border shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text-primary">Portföy Varlık Özeti</h3>
              <span className="text-xs text-text-muted">{summary.holdings.length} Aktif Varlık</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              Portföyünüzdeki hisse senetleri ve TEFAS yatırım fonları otomatik olarak güncel piyasa fiyatları üzerinden değerlenmektedir.
              Excel yükleme özelliği sayesinde geçmiş ekstrelerinizi tek tıkla aktarabilirsiniz.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-bg-secondary/60 border border-border/50">
                <span className="text-xs text-text-muted">Hisse Senetleri</span>
                <p className="text-lg font-bold text-text-primary mt-1">
                  {summary.holdings.filter((h) => h.assetType === 'stock').length} Adet
                </p>
              </div>
              <div className="p-4 rounded-xl bg-bg-secondary/60 border border-border/50">
                <span className="text-xs text-text-muted">Yatırım Fonları</span>
                <p className="text-lg font-bold text-text-primary mt-1">
                  {summary.holdings.filter((h) => h.assetType === 'fund').length} Adet
                </p>
              </div>
              <div className="p-4 rounded-xl bg-bg-secondary/60 border border-border/50 col-span-2 sm:col-span-1">
                <span className="text-xs text-text-muted">En Büyük Pozisyon</span>
                <p className="text-lg font-bold text-accent mt-1 truncate">
                  {summary.holdings.length > 0 ? summary.holdings[0].symbol : '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border mt-6 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-text-muted">Midas, İşCep, Garanti vb. ekstrelerinizi yükleyin</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadExcelTemplate}
                className="text-xs"
              >
                Şablon İndir
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsExcelModalOpen(true)}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 border-none"
              >
                Excel Yükle
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Holdings vs Transaction History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('holdings')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'holdings'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              Varlıklarım ({summary.holdings.length})
            </button>
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'heatmap'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              <span>Isı Haritası</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              İşlem Geçmişi ({activeTransactions.length})
            </button>
          </div>

          {activeTab === 'transactions' && activeTransactions.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsClearTxModalOpen(true)}
                className="text-xs border-red-500/30 text-rose-400 hover:bg-red-500/10 hover:border-red-500"
                leftIcon={
                  <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
              >
                İşlemleri Temizle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="text-xs"
              >
                Excel İndir (.xlsx)
              </Button>
            </div>
          )}
        </div>

        {activeTab === 'holdings' ? (
          <HoldingsTable
            holdings={summary.holdings}
            onAddTransaction={() => setIsTradeModalOpen(true)}
          />
        ) : activeTab === 'heatmap' ? (
          <div className="animate-fade-in">
            <PortfolioHeatmap />
          </div>
        ) : (
          /* Transaction History Table */
          <div className="rounded-2xl bg-bg-card border border-border shadow-sm overflow-hidden">
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
                  {activeTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="w-8 h-8 text-text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <p>Bu portföyde henüz işlem kaydı bulunmuyor.</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Button size="sm" variant="outline" onClick={() => setIsExcelModalOpen(true)}>
                              Excel / CSV İle Yükle
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => setIsTradeModalOpen(true)}>
                              Manuel İşlem Ekle
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-bg-hover transition-colors">
                        <td className="py-3.5 px-4 font-mono text-text-secondary">
                          {tx.transactionDate}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-text-primary">
                          {tx.symbol}
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
                            onClick={() => {
                              deleteTransaction(tx.id);
                              showToast({ type: 'info', title: 'İşlem Silindi', message: 'İşlem kaydı kaldırıldı.' });
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
        )}
      </div>

      {/* Manual Transaction Modal */}
      <TransactionModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
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
              {isDeleting ? 'Siliniyor...' : 'Evet, Portföyü Sil'}
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
              {isDeleting ? 'Temizleniyor...' : 'Tüm İşlemleri Temizle'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
