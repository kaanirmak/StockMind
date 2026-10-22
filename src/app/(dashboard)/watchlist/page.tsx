'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ReorderHandle } from '@/components/watchlist/ReorderHandle';
import { Icon } from '@/components/ui/Icon';
import { useWatchlistStore, WatchlistItem } from '@/store/useWatchlistStore';
import { Badge, Button, Input, Modal, useToast, InstrumentLogo } from '@/components/ui';
import { POPULAR_STOCKS } from '@/lib/constants/stocks';
import { POPULAR_FUNDS } from '@/lib/constants/funds';
import { PriceAlertModal } from '@/components/stocks/PriceAlertModal';

export default function WatchlistPage() {
  const { items, addItem, removeItem, syncStatus, retrySync, refreshFromServer } = useWatchlistStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [selectedItemForAlert, setSelectedItemForAlert] = useState<WatchlistItem | null>(null);
  const [activeOptionsId, setActiveOptionsId] = useState<string | null>(null);

  const [newAssetType, setNewAssetType] = useState<'stock' | 'fund'>('stock');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = (customTickerInput || selectedSymbol).toUpperCase().trim();
    if (!sym) return;

    setIsSubmitting(true);
    try {
      if (newAssetType === 'stock') {
        const res = await fetch(`/api/stocks/${sym}`);
        const data = await res.json();
        if (data.success && data.data) {
          addItem({
            symbol: sym,
            name: data.data.name || sym,
            assetType: 'stock',
            price: data.data.price || 0,
            changePercent: data.data.changePercent || 0,
            exchange: data.data.exchange || 'BIST',
          });
        } else { throw new Error('Fiyat alınamadı'); }
      } else {
        const res = await fetch(`/api/funds/${sym}`);
        const data = await res.json();
        if (data.success && data.data) {
          addItem({
            symbol: sym,
            name: data.data.name || sym,
            assetType: 'fund',
            price: data.data.price || 0,
            changePercent: data.data.dailyReturn || 0,
            exchange: 'TEFAS',
          });
        } else { throw new Error('Fon fiyatı alınamadı'); }
      }

      showToast({
        type: 'success',
        title: 'Takip Listesine Eklendi',
        message: `${sym} takip listenize eklendi.`,
      });
      setIsAddModalOpen(false);
      setSelectedSymbol('');
      setCustomTickerInput('');
    } catch (err) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: 'Varlık eklenirken bir sorun oluştu.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveItem = (id: string, sym: string) => {
    removeItem(id);
    showToast({
      type: 'info',
      title: 'Listeden Kaldırıldı',
      message: `${sym} takip listenizden çıkarıldı.`,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="text-lg font-semibold text-text-primary">Takip Listem <span className="text-sm text-text-muted">({items.length})</span></h1>{syncStatus === 'syncing' && <p className="text-xs text-text-muted">Senkronize ediliyor…</p>}</div>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)}>+ Varlık Ekle</Button>
      </div>

      {syncStatus === 'error' && <div role="alert" className="rounded-xl p-3 bg-warning/10 text-warning text-sm flex items-center justify-between gap-2"><p>Değişiklikleriniz henüz hesabınıza kaydedilemedi.</p><Button variant="secondary" onClick={() => { retrySync(); void refreshFromServer(); }}>Tekrar Dene</Button></div>}
      {/* Watchlist Mobile Compact Card View (md:hidden) */}
      <div className="md:hidden space-y-2.5">
        {items.length === 0 ? (
          <div className="glass-card p-8 text-center text-text-muted space-y-3">
            <p className="text-sm font-medium text-text-secondary">İzleme listenizde henüz varlık bulunmuyor.</p>
            <p className="text-xs">Takip etmek istediğiniz hisse veya fonları ekleyebilirsiniz.</p>
          </div>
        ) : (
          items.map((item) => {
            const isPositive = item.changePercent >= 0;
            const link = item.assetType === 'stock' ? `/stocks/${item.symbol}` : `/funds/${item.symbol}`;
            const curr = item.exchange === 'NASDAQ' || item.exchange === 'NYSE' ? '$' : '₺';
            const isOptionsOpen = activeOptionsId === item.id;

            return (
              <div
                key={`m-wl-${item.id}`}
                data-watchlist-id={item.id}
                className="glass-card p-3 rounded-2xl border border-border/70 hover:border-accent/40 transition-all flex flex-col gap-2 relative"
              >
                {/* Row 1: Symbol, Logo, Market & Price + Change in single row */}
                <div className="flex items-center justify-between gap-2">
                  <Link href={link} className="flex items-center gap-2.5 min-w-0 flex-1">
                    <InstrumentLogo symbol={item.symbol} name={item.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-text-primary hover:text-accent transition-colors font-mono">
                          {item.symbol}
                        </span>
                        <Badge variant={item.assetType === 'stock' ? 'purple' : 'info'} size="sm">
                          {item.exchange || item.assetType}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-text-muted truncate block max-w-[130px]">
                        {item.name}
                      </span>
                    </div>
                  </Link>

                  {/* Price & Change */}
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-text-primary">
                      {curr}{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: item.assetType === 'fund' ? 4 : 2 })}
                    </div>
                    <span
                      className={`font-semibold text-[11px] px-1.5 py-0.5 rounded font-mono inline-block ${
                        isPositive ? 'text-success bg-success/15' : 'text-danger bg-danger/15'
                      }`}
                    >
                      {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Row 2: Alarm Status, Reorder Handle & Options Menu */}
                <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-xs">
                  {/* Alarm chip */}
                  <div className="min-w-0">
                    {item.targetPrice ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemForAlert(item);
                          setIsAlertModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-warning bg-warning/10 hover:bg-warning/20 border border-warning/30 px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold transition-colors cursor-pointer"
                        title="Alarmı düzenle veya kaldır"
                      >
                        <Icon name="bell" className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">
                          {item.alertType === 'percent_up'
                            ? `+${item.alertPercent}% (₺${item.targetPrice.toFixed(2)})`
                            : item.alertType === 'percent_down'
                            ? `-${item.alertPercent}% (₺${item.targetPrice.toFixed(2)})`
                            : `₺${item.targetPrice.toFixed(2)}`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemForAlert(item);
                          setIsAlertModalOpen(true);
                        }}
                        className="text-[11px] text-text-muted hover:text-accent font-medium flex items-center gap-1 transition-colors cursor-pointer py-0.5"
                      >
                        <Icon name="bell" className="h-3 w-3" />
                        <span>Alarm Kur</span>
                      </button>
                    )}
                  </div>

                  {/* Right side: Reorder + Options Button */}
                  <div className="flex items-center gap-1 shrink-0">
                    <ReorderHandle id={item.id} symbol={item.symbol} />

                    {/* Options (Three Dots) Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveOptionsId(isOptionsOpen ? null : item.id)}
                        aria-label={`${item.symbol} seçenekleri`}
                        className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {isOptionsOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveOptionsId(null)}
                          />
                          <div className="absolute right-0 bottom-full mb-1 w-44 z-50 bg-bg-card border border-border/80 rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                            <Link
                              href={link}
                              onClick={() => setActiveOptionsId(null)}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                            >
                              <Icon name="chart" className="w-3.5 h-3.5 text-accent" />
                              <span>Grafik & Detay</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveOptionsId(null);
                                setSelectedItemForAlert(item);
                                setIsAlertModalOpen(true);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-text-primary hover:bg-bg-hover rounded-lg transition-colors cursor-pointer text-left"
                            >
                              <Icon name="bell" className="w-3.5 h-3.5 text-warning" />
                              <span>Fiyat Alarmı</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveOptionsId(null);
                                handleRemoveItem(item.id, item.symbol);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer text-left font-medium"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Listeden Kaldır</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Watchlist Desktop Table (hidden md:block) */}
      <div className="hidden md:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Sembol & Adı</th>
                <th className="py-3.5 px-4 font-semibold">Piyasa / Tür</th>
                <th className="py-3.5 px-4 font-semibold text-right">Anlık Fiyat</th>
                <th className="py-3.5 px-4 font-semibold text-right">Günlük Değişim</th>
                <th className="py-3.5 px-4 font-semibold text-right">Hedef Fiyat / Alarm</th>
                <th className="py-3.5 px-4 text-center">Hızlı İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-text-secondary">İzleme listenizde henüz varlık bulunmuyor.</p>
                      <p className="text-xs">Yukarıdaki &quot;Varlık Ekle&quot; butonuna basarak takip etmek istediğiniz hisse veya fonları ekleyebilirsiniz.</p>

                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isPositive = item.changePercent >= 0;
                  const link = item.assetType === 'stock' ? `/stocks/${item.symbol}` : `/funds/${item.symbol}`;

                  return (
                    <tr key={item.id} data-watchlist-id={item.id} className="hover:bg-bg-hover/60 transition-colors group">
                      <td className="py-3.5 px-4">
                        <Link href={link} className="flex items-center gap-3">
                          <InstrumentLogo symbol={item.symbol} name={item.name} size="md" />
                          <div>
                            <span className="font-bold text-text-primary block group-hover:text-accent transition-colors">
                              {item.symbol}
                            </span>
                            <span className="text-xs text-text-muted line-clamp-1 max-w-xs">
                              {item.name}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={item.assetType === 'stock' ? 'purple' : 'info'} size="sm">
                          {item.exchange || item.assetType}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                        {item.exchange === 'NASDAQ' || item.exchange === 'NYSE' ? '$' : '₺'}
                        {item.price.toFixed(item.assetType === 'fund' ? 4 : 2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span
                          className={`font-semibold text-xs px-2.5 py-1 rounded-lg ${
                            isPositive ? 'text-success bg-success/15' : 'text-danger bg-danger/15'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {item.changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-text-secondary">
                        {item.targetPrice ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemForAlert(item);
                              setIsAlertModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-warning bg-warning/10 hover:bg-warning/20 border border-warning/30 px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer"
                            title="Alarmı düzenle veya kaldır"
                          >
                            <Icon name="bell" className="h-4 w-4" />
                            <span>
                              {item.alertType === 'percent_up'
                                ? `+%${item.alertPercent} (₺${item.targetPrice.toFixed(2)})`
                                : item.alertType === 'percent_down'
                                ? `-%${item.alertPercent} (₺${item.targetPrice.toFixed(2)})`
                                : item.alertType === 'percent_both'
                                ? `±%${item.alertPercent} (₺${item.targetPrice.toFixed(2)})`
                                : `₺${item.targetPrice.toFixed(2)}`}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemForAlert(item);
                              setIsAlertModalOpen(true);
                            }}
                            className="text-xs text-text-muted hover:text-accent underline transition-colors cursor-pointer"
                          >
                            + Alarm Kur
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ReorderHandle id={item.id} symbol={item.symbol} />
                          <Link href={link}>
                            <Button variant="ghost" size="sm">
                              Grafik &rarr;
                            </Button>
                          </Link>
                          <button
                            onClick={() => handleRemoveItem(item.id, item.symbol)}
                            className="p-1.5 text-text-muted hover:text-danger rounded-lg transition-colors cursor-pointer"
                            title="Listeden Çıkar"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="İzleme Listesine Ekle"
        description="Takip etmek istediğiniz hisse veya TEFAS fonunu seçin."
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-bg-secondary rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setNewAssetType('stock')}
              className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                newAssetType === 'stock' ? 'bg-accent text-white shadow' : 'text-text-muted'
              }`}
            >
              Hisse Senedi
            </button>
            <button
              type="button"
              onClick={() => setNewAssetType('fund')}
              className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                newAssetType === 'fund' ? 'bg-accent text-white shadow' : 'text-text-muted'
              }`}
            >
              TEFAS Fonu
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              {newAssetType === 'stock' ? 'Hisse Kodu Yazın veya Seçin' : 'Fon Kodu Yazın veya Seçin'}
            </label>
            <div className="space-y-2">
              <Input
                placeholder={newAssetType === 'stock' ? 'Örn: ASTOR, KONTR, REEDR, NVDA...' : 'Örn: KZL, TI2, MAC, NRC, AFT...'}
                value={customTickerInput}
                onChange={(e) => {
                  setCustomTickerInput(e.target.value.toUpperCase());
                  setSelectedSymbol('');
                }}
              />
              <div className="text-center text-xs text-text-muted">veya listeden seçin:</div>
              <select
                value={selectedSymbol}
                onChange={(e) => {
                  setSelectedSymbol(e.target.value);
                  setCustomTickerInput(e.target.value);
                }}
                className="w-full bg-bg-input text-text-primary text-sm rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none"
              >
                <option value="">Listeden hızlı seçin...</option>
                {newAssetType === 'stock'
                  ? POPULAR_STOCKS.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} — {s.name} ({s.exchange})
                      </option>
                    ))
                  : POPULAR_FUNDS.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.code} — {f.name}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || (!customTickerInput && !selectedSymbol)}>
              {isSubmitting ? 'Ekleniyor...' : 'Listeye Ekle'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Smart Price & Percentage Alert Modal */}
      <PriceAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => {
          setIsAlertModalOpen(false);
          setSelectedItemForAlert(null);
        }}
        stock={selectedItemForAlert}
      />
    </div>
  );
}
