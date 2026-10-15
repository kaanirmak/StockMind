'use client';
import { Icon as UIIcon } from '@/components/ui/Icon';


import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui';
import {
  useWatchlistStore,
  PriceAlertType,
  calculateTargetPriceFromPercent,
} from '@/store/useWatchlistStore';
import { sendPushNotification } from '@/lib/notifications/pushNotification';

export interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: {
    symbol: string;
    name: string;
    price: number;
    changePercent?: number;
    exchange?: string;
    assetType?: 'stock' | 'fund';
  } | null;
}

const PERCENT_PRESETS = [1, 2, 3, 5, 10];

export function PriceAlertModal({ isOpen, onClose, stock }: PriceAlertModalProps) {
  const { showToast } = useToast();
  const { items, setAlert, removeAlert } = useWatchlistStore();

  const [mode, setMode] = useState<'percent' | 'price'>('percent');
  const [direction, setDirection] = useState<'up' | 'down' | 'both'>('up');
  const [selectedPercent, setSelectedPercent] = useState<number>(2);
  const [customPercent, setCustomPercent] = useState<string>('');
  const [targetPriceInput, setTargetPriceInput] = useState<string>('');

  const currentPrice = stock?.price || 0;
  const existingItem = stock
    ? items.find((i) => i.symbol.toUpperCase() === stock.symbol.toUpperCase())
    : null;
  const hasExistingAlert = Boolean(existingItem?.targetPrice || existingItem?.alertPercent);

  // Initialize form state when modal opens or stock changes
  useEffect(() => {
    if (!stock || !isOpen) return;

    if (existingItem?.alertType && existingItem.alertType !== 'price' && existingItem.alertPercent) {
      setMode('percent');
      setSelectedPercent(existingItem.alertPercent);
      setCustomPercent(PERCENT_PRESETS.includes(existingItem.alertPercent) ? '' : existingItem.alertPercent.toString());
      if (existingItem.alertType === 'percent_up') setDirection('up');
      else if (existingItem.alertType === 'percent_down') setDirection('down');
      else setDirection('both');
      setTargetPriceInput(existingItem.targetPrice ? existingItem.targetPrice.toString() : '');
    } else if (existingItem?.targetPrice) {
      setMode('price');
      setTargetPriceInput(existingItem.targetPrice.toString());
      setSelectedPercent(2);
      setDirection(existingItem.targetPrice >= currentPrice ? 'up' : 'down');
    } else {
      setMode('percent');
      setDirection('up');
      setSelectedPercent(2);
      setCustomPercent('');
      setTargetPriceInput(
        currentPrice > 0 ? (currentPrice * 1.02).toFixed(2) : ''
      );
    }
  }, [stock, isOpen, existingItem]);

  if (!stock) return null;

  // Active percent calculation
  const activePercent = customPercent && !isNaN(Number(customPercent)) && Number(customPercent) > 0
    ? Number(customPercent)
    : selectedPercent;

  // Compute preview target price for percentage mode
  const computedPercentTargetPrice =
    direction === 'down'
      ? calculateTargetPriceFromPercent(currentPrice, activePercent, 'down')
      : calculateTargetPriceFromPercent(currentPrice, activePercent, 'up');

  // Compute percentage diff for fixed price mode
  const fixedPriceNum = Number(targetPriceInput) || 0;
  const fixedPriceDiffPercent =
    currentPrice > 0 && fixedPriceNum > 0
      ? ((fixedPriceNum - currentPrice) / currentPrice) * 100
      : 0;

  const handleSaveAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stock || currentPrice <= 0) return;

    let finalAlertType: PriceAlertType = 'price';
    let finalTargetPrice = 0;
    let finalPercent: number | undefined = undefined;
    let descriptionText = '';

    if (mode === 'percent') {
      if (direction === 'up') finalAlertType = 'percent_up';
      else if (direction === 'down') finalAlertType = 'percent_down';
      else finalAlertType = 'percent_both';

      finalPercent = activePercent;
      finalTargetPrice = computedPercentTargetPrice;

      if (direction === 'up') {
        descriptionText = `₺${currentPrice.toFixed(2)} seviyesinden %${activePercent} yükseldiğinde (₺${finalTargetPrice.toFixed(2)})`;
      } else if (direction === 'down') {
        descriptionText = `₺${currentPrice.toFixed(2)} seviyesinden %${activePercent} düştüğünde (₺${finalTargetPrice.toFixed(2)})`;
      } else {
        descriptionText = `₺${currentPrice.toFixed(2)} seviyesinden %${activePercent} yukarı veya aşağı saptığında`;
      }
    } else {
      finalAlertType = 'price';
      finalTargetPrice = Number(targetPriceInput);
      if (finalTargetPrice <= 0) {
        showToast({
          type: 'danger',
          title: 'Geçersiz Fiyat',
          message: 'Lütfen 0 dan büyük geçerli bir hedef fiyat girin.',
        });
        return;
      }
      descriptionText = `fiyatı ₺${finalTargetPrice.toFixed(2)} seviyesine ulaştığında`;
    }

    setAlert(
      stock.symbol,
      {
        targetPrice: finalTargetPrice,
        alertType: finalAlertType,
        alertPercent: finalPercent,
        alertBasePrice: currentPrice,
      },
      {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        changePercent: stock.changePercent || 0,
        exchange: stock.exchange || 'BIST',
        assetType: stock.assetType || 'stock',
      }
    );

    // Send push confirmation
    sendPushNotification(
      ` Fiyat Alarmı: ${stock.symbol}`,
      `${stock.name || stock.symbol} ${descriptionText} telefonunuza anlık sesli bildirim gelecektir.`,
      '/watchlist'
    );

    showToast({
      type: 'success',
      title: "Fiyat Alarmı Kuruldu ",
      message: `${stock.symbol} ${descriptionText} anlık bildirim alacaksınız.`,
    });

    onClose();
  };

  const handleRemove = () => {
    if (!stock) return;
    removeAlert(stock.symbol);
    showToast({
      type: 'info',
      title: 'Alarm Kaldırıldı',
      message: `${stock.symbol} için kurulmuş olan fiyat alarmı silindi.`,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${stock.symbol} — Akıllı Fiyat Alarmı`}
      description="Hisse belirlediğiniz yüzde veya fiyata ulaştığında anlık sesli bildirim alın."
    >
      <form onSubmit={handleSaveAlert} className="space-y-4 pt-1">
        {/* Stock Summary Header */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-bg-secondary/70 border border-border">
          <div className="min-w-0">
            <span className="text-xs text-text-muted truncate block">{stock.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-bold text-base text-text-primary font-mono">
                ₺{currentPrice.toFixed(2)}
              </span>
              {stock.changePercent !== undefined && (
                <span
                  className={`text-xs font-semibold font-mono ${
                    stock.changePercent >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {stock.changePercent >= 0 ? '+' : ''}
                  {stock.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-accent/15 text-accent border border-accent/20">
            Canlı Fiyat
          </span>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-bg-secondary border border-border text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('percent')}
            className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'percent'
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span><UIIcon name="chart" className="w-4 h-4" /></span>
            <span>Yüzdesel Değişim (%)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('price')}
            className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'price'
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span><UIIcon name="sparkles" className="w-4 h-4" /></span>
            <span>Hedef Fiyat (₺)</span>
          </button>
        </div>

        {/* MODE 1: PERCENTAGE CHANGE */}
        {mode === 'percent' ? (
          <div className="space-y-3 animate-fade-in">
            {/* Direction Selection */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Hareket Yönü
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('up')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    direction === 'up'
                      ? 'border-success bg-success/15 text-success shadow-sm'
                      : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                  }`}
                >
                  <span><UIIcon name="chart" className="w-4 h-4" /></span>
                  <span>Yükseliş (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('down')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    direction === 'down'
                      ? 'border-danger bg-danger/15 text-danger shadow-sm'
                      : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                  }`}
                >
                  <span><UIIcon name="chart" className="w-4 h-4" /></span>
                  <span>Düşüş (-)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('both')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    direction === 'both'
                      ? 'border-warning bg-warning/15 text-warning shadow-sm'
                      : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                  }`}
                >
                  <span><UIIcon name="sparkles" className="w-4 h-4" /></span>
                  <span>Sapma (±)</span>
                </button>
              </div>
            </div>

            {/* Percent Presets */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Değişim Oranı
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {PERCENT_PRESETS.map((p) => {
                  const isSelected = selectedPercent === p && !customPercent;
                  const prefix = direction === 'down' ? '-%' : direction === 'both' ? '±%' : '+%';
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedPercent(p);
                        setCustomPercent('');
                      }}
                      className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-accent text-white border-accent shadow-md shadow-accent/25 scale-[1.02]'
                          : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary hover:border-accent/40'
                      }`}
                    >
                      {prefix}{p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Percent Input */}
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1">
                Veya Özel Yüzde Belirtin (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1000"
                  value={customPercent}
                  onChange={(e) => setCustomPercent(e.target.value)}
                  placeholder="Örn: 1.5, 2.5, 4"
                  className="w-full bg-bg-input border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none font-mono"
                />
                <span className="absolute right-3 top-2 text-xs text-text-muted font-bold">%</span>
              </div>
            </div>

            {/* Calculation Preview Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-bg-secondary to-bg-card border border-accent/25 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Tetiklenme Eşik Fiyatı:</span>
                <span className="font-mono font-extrabold text-sm text-accent">
                  {direction === 'both' ? (
                    <>
                      ₺{(currentPrice * (1 - activePercent / 100)).toFixed(2)} — ₺{(currentPrice * (1 + activePercent / 100)).toFixed(2)}
                    </>
                  ) : (
                    `₺${computedPercentTargetPrice.toFixed(2)}`
                  )}
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {direction === 'up' && (
                  <> {stock.symbol} fiyatı ₺{currentPrice.toFixed(2)} seviyesinden <strong>%+{activePercent}</strong> yükselerek <strong>₺{computedPercentTargetPrice.toFixed(2)}</strong> seviyesine ulaştığında alarm çalar.</>
                )}
                {direction === 'down' && (
                  <> {stock.symbol} fiyatı ₺{currentPrice.toFixed(2)} seviyesinden <strong>%-{activePercent}</strong> gerileyerek <strong>₺{computedPercentTargetPrice.toFixed(2)}</strong> seviyesine düştüğünde alarm çalar.</>
                )}
                {direction === 'both' && (
                  <> {stock.symbol} fiyatı her iki yönde <strong>%±{activePercent}</strong> kırıldığında anlık bildirim tetiklenir.</>
                )}
              </p>
            </div>
          </div>
        ) : (
          /* MODE 2: FIXED PRICE */
          <div className="space-y-3 animate-fade-in">
            <Input
              label="Hedef Fiyat (₺)"
              type="number"
              step="0.01"
              value={targetPriceInput}
              onChange={(e) => setTargetPriceInput(e.target.value)}
              required
              helperText={`Anlık Fiyat: ₺${currentPrice.toFixed(2)}`}
              placeholder="Örn: 350.50"
            />

            {fixedPriceNum > 0 && currentPrice > 0 && (
              <div className="p-3 rounded-2xl bg-bg-secondary border border-border text-xs flex items-center justify-between">
                <span className="text-text-muted">Fiyat Farkı:</span>
                <span
                  className={`font-mono font-bold ${
                    fixedPriceDiffPercent >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {fixedPriceDiffPercent >= 0 ? '+' : ''}
                  {fixedPriceDiffPercent.toFixed(2)}% ({fixedPriceDiffPercent >= 0 ? 'Yukarıda' : 'Aşağıda'})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Channels Info */}
        <div className="flex items-center gap-2 pt-1 text-[11px] text-text-muted">
          <span> Bildirim Kanalı:</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
             Telefon Üst Bildirimi
          </span>
          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
             Sesli Uyarı
          </span>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/60">
          {hasExistingAlert ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleRemove}
              className="text-xs"
            >
              Alarmı Kaldır
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" variant="primary" size="sm" className="font-bold">
              {hasExistingAlert ? 'Alarmı Güncelle' : "Alarmı Kur "}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default PriceAlertModal;
