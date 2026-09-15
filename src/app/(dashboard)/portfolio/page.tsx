'use client';

import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioAllocationChart } from '@/components/portfolio/PortfolioAllocationChart';
import { TransactionModal } from '@/components/portfolio/TransactionModal';
import { Badge, Button, Modal, Input, useToast } from '@/components/ui';

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
    link.setAttribute('download', `${activePortfolio.name}_varliklar.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({ type: 'success', title: 'CSV İndirildi', message: 'Portföy varlıkları CSV olarak kaydedildi.' });
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

          <Button variant="secondary" size="md" onClick={handleExportCSV} leftIcon={
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }>
            CSV İndir
          </Button>

          <Button variant="primary" size="md" onClick={() => setIsTradeModalOpen(true)} leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }>
            İşlem Ekle
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Value */}
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-text-muted font-medium block">Toplam Portföy Değeri</span>
          <div className="text-2xl font-black font-mono text-text-primary">
            ₺{summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-text-muted block">
            {summary.holdings.length} farklı varlık
          </span>
        </div>

        {/* Total Cost */}
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-text-muted font-medium block">Toplam Yatırım Tutarı (Maliyet)</span>
          <div className="text-2xl font-black font-mono text-text-secondary">
            ₺{summary.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-text-muted block">
            Komisyonlar dahil net maliyet
          </span>
        </div>

        {/* Total PnL */}
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-text-muted font-medium block">Toplam Kar / Zarar</span>
          <div className={`text-2xl font-black font-mono ${isProfit ? 'text-success' : 'text-danger'}`}>
            {isProfit ? '+' : ''}₺{summary.totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <span className={`text-xs font-bold inline-block px-2 py-0.5 rounded ${isProfit ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
            {isProfit ? '+' : ''}{summary.totalPnLPercent.toFixed(2)}%
          </span>
        </div>

        {/* Daily PnL */}
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-text-muted font-medium block">Günlük Değişim</span>
          <div className="text-2xl font-black font-mono text-success">
            +₺{summary.dailyPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs font-bold inline-block px-2 py-0.5 rounded bg-success/15 text-success">
            +{summary.dailyPnLPercent.toFixed(2)}% (Bugün)
          </span>
        </div>
      </div>

      {/* Allocation Chart */}
      {summary.holdings.length > 0 && (
        <PortfolioAllocationChart
          allocation={summary.allocation}
          totalValue={summary.totalValue}
        />
      )}

      {/* Section Tabs: Holdings vs Transactions */}
      <div className="space-y-4">
        <div className="flex items-center gap-4 border-b border-border/80 pb-2">
          <button
            onClick={() => setActiveTab('holdings')}
            className={`pb-2 text-sm font-semibold transition-colors cursor-pointer relative ${
              activeTab === 'holdings' ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Varlıklarım ({summary.holdings.length})
            {activeTab === 'holdings' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-2 text-sm font-semibold transition-colors cursor-pointer relative ${
              activeTab === 'transactions' ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            İşlem Geçmişi ({activeTransactions.length})
            {activeTab === 'transactions' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        </div>

        {activeTab === 'holdings' ? (
          <HoldingsTable
            holdings={summary.holdings}
            onAddTransaction={() => setIsTradeModalOpen(true)}
          />
        ) : (
          /* Transaction History Table */
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Tarih</th>
                    <th className="py-3.5 px-4 font-semibold">Varlık / Sembol</th>
                    <th className="py-3.5 px-4 font-semibold">İşlem Türü</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Adet</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Birim Fiyat</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Toplam Tutar</th>
                    <th className="py-3.5 px-4 font-semibold">Not</th>
                    <th className="py-3.5 px-4 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {activeTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-text-muted text-xs">
                        Bu portföyde henüz işlem kaydı bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    activeTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-bg-hover/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
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

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
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
