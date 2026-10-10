'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useWatchlistStore, WatchlistItem } from '@/store/useWatchlistStore';
import { Badge, Button, Input, Modal, useToast, InstrumentLogo } from '@/components/ui';
import { POPULAR_STOCKS } from '@/lib/data/stocks';
import { TEFAS_FUNDS } from '@/lib/data/funds';
import { sendPushNotification } from '@/lib/notifications/pushNotification';

export default function WatchlistPage() {
  const { items, addItem, removeItem, setTargetPrice } = useWatchlistStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [selectedItemForAlert, setSelectedItemForAlert] = useState<WatchlistItem | null>(null);
  const [alertTargetPrice, setAlertTargetPrice] = useState<string>('');

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
            price: data.data.price || 100,
            changePercent: data.data.changePercent || 0,
            exchange: data.data.exchange || 'BIST',
          });
        } else {
          const stock = POPULAR_STOCKS.find((s) => s.symbol === sym);
          addItem({
            symbol: sym,
            name: stock ? stock.name : sym,
            assetType: 'stock',
            price: stock ? stock.basePrice : 100,
            changePercent: 0,
            exchange: 'BIST',
          });
        }
      } else {
        const res = await fetch(`/api/funds/${sym}`);
        const data = await res.json();
        if (data.success && data.data) {
          addItem({
            symbol: sym,
            name: data.data.name || sym,
            assetType: 'fund',
            price: data.data.price || 5.0,
            changePercent: data.data.dailyReturn || 0,
            exchange: 'TEFAS',
          });
        } else {
          const fund = TEFAS_FUNDS.find((f) => f.code === sym);
          addItem({
            symbol: sym,
            name: fund ? fund.name : sym,
            assetType: 'fund',
            price: fund ? fund.price : 5.0,
            changePercent: 0,
            exchange: 'TEFAS',
          });
        }
      }

      showToast({
        type: 'success',
        title: 'Takip Listesine Eklendi ⭐',
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

  const handleSetAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAlert || !alertTargetPrice) return;

    setTargetPrice(selectedItemForAlert.id, Number(alertTargetPrice));

    // Send push notification confirmation to phone
    sendPushNotification(
      `🎯 Fiyat Alarmı: ${selectedItemForAlert.symbol}`,
      `${selectedItemForAlert.symbol} fiyatı ₺${alertTargetPrice} seviyesine ulaştığında telefonunuza anlık bildirim gelecektir.`,
      '/watchlist'
    );

    showToast({
      type: 'success',
      title: 'Fiyat Alarmı Kuruldu',
      message: `${selectedItemForAlert.symbol} fiyatı ₺${alertTargetPrice} seviyesine ulaştığında bildirim alacaksınız.`,
    });

    setIsAlertModalOpen(false);
    setSelectedItemForAlert(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">İzleme Listesi (Watchlist)</h1>
            <Badge variant="purple" size="sm">
              {items.length} Varlık Takip Ediliyor
            </Badge>
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Yıldızladığınız hisse ve TEFAS fonlarını tek ekrandan canlı izleyin ve fiyat alarmları kurun.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Varlık Ekle
        </Button>
      </div>

      {/* Watchlist Mobile Card View (md:hidden) */}
      <div className="md:hidden space-y-3">
        {items.length === 0 ? (
          <div className="glass-card p-8 text-center text-text-muted space-y-3">
            <p className="text-sm font-medium text-text-secondary">İzleme listenizde henüz varlık bulunmuyor.</p>
            <p className="text-xs">Takip etmek istediğiniz hisse veya fonları ekleyebilirsiniz.</p>
            <Button variant="secondary" size="sm" onClick={() => setIsAddModalOpen(true)}>
              + İlk Varlığı Ekle
            </Button>
          </div>
        ) : (
          items.map((item) => {
            const isPositive = item.changePercent >= 0;
            const link = item.assetType === 'stock' ? `/stocks/${item.symbol}` : `/funds/${item.symbol}`;
            const curr = item.exchange === 'NASDAQ' || item.exchange === 'NYSE' ? '$' : '₺';

            return (
              <div
                key={`m-wl-${item.id}`}
                className="glass-card p-4 rounded-2xl border border-border/80 shadow-xs hover:border-accent/40 transition-all flex flex-col gap-3"
              >
                {/* Header: Logo, Symbol, Name & Market Badge */}
                <div className="flex items-center justify-between">
                  <Link href={link} className="flex items-center gap-2.5 min-w-0 flex-1">
                    <InstrumentLogo symbol={item.symbol} name={item.name} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-primary hover:text-accent transition-colors">
                          {item.symbol}
                        </span>
                        <Badge variant={item.assetType === 'stock' ? 'purple' : 'info'} size="sm">
                          {item.exchange || item.assetType}
                        </Badge>
                      </div>
                      <span className="text-xs text-text-muted truncate block">
                        {item.name}
                      </span>
                    </div>
                  </Link>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveItem(item.id, item.symbol)}
                    className="p-1.5 text-text-muted hover:text-danger rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Listeden Çıkar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Price & Change Row */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div>
                    <span className="text-[10px] text-text-muted block">Anlık Fiyat</span>
                    <span className="text-base font-bold font-mono text-text-primary">
                      {curr}{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: item.assetType === 'fund' ? 4 : 2 })}
                    </span>
                  </div>

                  <span
                    className={`font-semibold text-xs px-2.5 py-1 rounded-lg font-mono ${
                      isPositive ? 'text-success bg-success/15' : 'text-danger bg-danger/15'
                    }`}
                  >
                    {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </span>
                </div>

                {/* Footer: Target Price / Alarm & Quick Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <div>
                    {item.targetPrice ? (
                      <span className="inline-flex items-center gap-1.5 text-warning bg-warning/10 px-2 py-1 rounded-lg text-xs font-mono font-semibold">
                        🔔 ₺{item.targetPrice.toFixed(2)}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedItemForAlert(item);
                          setAlertTargetPrice(item.price.toString());
                          setIsAlertModalOpen(true);
                        }}
                        className="text-xs text-text-muted hover:text-accent font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>🔔</span>
                        <span>Alarm Kur</span>
                      </button>
                    )}
                  </div>

                  <Link href={link}>
                    <Button variant="ghost" size="sm" className="text-xs font-semibold">
                      Grafik & Detay &rarr;
                    </Button>
                  </Link>
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
                      <Button variant="secondary" size="sm" onClick={() => setIsAddModalOpen(true)}>
                        + İlk Varlığı Ekle
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isPositive = item.changePercent >= 0;
                  const link = item.assetType === 'stock' ? `/stocks/${item.symbol}` : `/funds/${item.symbol}`;

                  return (
                    <tr key={item.id} className="hover:bg-bg-hover/60 transition-colors group">
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
                          <span className="inline-flex items-center gap-1.5 text-warning bg-warning/10 px-2 py-0.5 rounded text-xs">
                            🔔 ₺{item.targetPrice.toFixed(2)}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedItemForAlert(item);
                              setAlertTargetPrice(item.price.toString());
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
                  : TEFAS_FUNDS.map((f) => (
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

      {/* Alert Modal */}
      <Modal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        title={`${selectedItemForAlert?.symbol} — Fiyat Alarmı`}
        description="Fiyat belirlediğiniz seviyeye ulaştığında anlık uyarı alın."
      >
        <form onSubmit={handleSetAlert} className="space-y-4">
          <Input
            label="Hedef Fiyat"
            type="number"
            step="0.01"
            value={alertTargetPrice}
            onChange={(e) => setAlertTargetPrice(e.target.value)}
            required
            helperText={`Anlık Fiyat: ₺${selectedItemForAlert?.price.toFixed(2)}`}
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsAlertModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit" variant="primary">
              Alarmı Kaydet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
