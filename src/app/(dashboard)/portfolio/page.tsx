'use client';

import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioAllocationChart } from '@/components/portfolio/PortfolioAllocationChart';
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
    transactions,
    deleteTransaction,
    getSummary,
    fetchPortfoliosAndTransactions,
  } = usePortfolioStore();

  const { showToast } = useToast();
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isNewPortModalOpen, setIsNewPortModalOpen] = useState(false);
  const [newPortName, setNewPortName] = useState('');
  const [newPortDesc, setNewPortDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'holdings' | 'transactions'>('holdings');

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  const summary = getSummary();
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];
  const activeTransactions = transactions.filter((t) => t.portfolioId === activePortfolioId);

  const isProfit = summary.totalPnL >= 0;

  const handleCreatePortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortName) return;
    addPortfolio(newPortName, newPortDesc);
    showToast({
      type: 'success',
      title: 'Portföy Oluşturuldu',
      message: `"${newPortName}" portföyü başarıyla oluşturuldu.`,
    });
    setNewPortName('');
    setNewPortDesc('');
    setIsNewPortModalOpen(false);
  };

  const handleExportCSV = () => {
    if (summary.holdings.length === 0) {
      showToast({ type: 'warning', title: 'Veri Yok', message: 'Dışa aktarılacak varlık bulunmuyor.' });
      return;
    }

    const headers = 'Sembol,Varlık Türü,Adet,Ortalama Maliyet,Son Fiyat,Toplam Değer,Kar Zarar,Kar Zarar Yüzdesi,Ağırlık\n';
    const rows = summary.holdings
      .map(
        (h) =>
          `${h.symbol},${h.assetType},${h.totalQuantity},${h.averageCost},${h.currentPrice},${h.currentValue},${h.pnl},${h.pnlPercent}%,%${h.weight}`
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
            Varlıklarınızı, maliyetlerinizi, anlık kar/zararınızı ve dağılımınızı yönetin.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Portfolio Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border">
            {portfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePortfolioId(p.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activePortfolioId === p.id
                    ? 'bg-accent text-white shadow'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {p.name}
              </button>
            ))}
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

        {/* Daily PnL */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Günlük Değişim</p>
          <h3 className={`text-2xl font-black mt-1 font-mono ${summary.dailyPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {summary.dailyPnL >= 0 ? '+' : ''}₺{summary.dailyPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <Badge variant={summary.dailyPnLPercent >= 0 ? 'success' : 'danger'} size="sm">
              {summary.dailyPnLPercent >= 0 ? '+' : ''}{summary.dailyPnLPercent.toFixed(2)}%
            </Badge>
            <span className="text-text-muted">bugün</span>
          </div>
        </div>

        {/* Active Holdings Count */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Varlık Sayısı</p>
          <h3 className="text-2xl font-black text-text-primary mt-1 font-mono">
            {summary.holdings.length} <span className="text-sm font-normal text-text-muted">Pozisyon</span>
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
            <span>{activeTransactions.length} Toplam İşlem</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Allocation Chart & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PortfolioAllocationChart allocation={summary.allocation} totalValue={summary.totalValue} />
        </div>

        <div className="lg:col-span-2 flex flex-col justify-between p-6 rounded-2xl bg-bg-card border border-border shadow-sm">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="text-xs"
            >
              Excel İndir (.xlsx)
            </Button>
          )}
        </div>

        {activeTab === 'holdings' ? (
          <HoldingsTable
            holdings={summary.holdings}
            onAddTransaction={() => setIsTradeModalOpen(true)}
          />
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
    </div>
  );
}
