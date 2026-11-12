'use client';
import { Icon as UIIcon } from '@/components/ui/Icon';


import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui';
import {
  useWatchlistStore,
  calculateTargetPriceFromPercent,
} from '@/store/useWatchlistStore';
import {
  buildQuickAlertConfig,
  formatAlertPrice,
  getAlertCurrencySymbol,
  inferAssetAlertCurrency,
  type AlertCurrencyCode,
  type AlertDirection,
  type AlertThresholdMode,
  type IndicatorAlertKind,
} from '@/lib/market/alertForm';
import { sendPushNotification } from '@/lib/notifications/pushNotification';
import { useAuth } from '@/hooks/useAuth';
import { ProRequestModal } from '@/components/pro/ProRequestModal';

export interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: {
    symbol: string;
    name: string;
    price: number;
    changePercent?: number;
    exchange?: string;
    currency?: string;
    assetType?: 'stock' | 'fund';
  } | null;
}

const PERCENT_PRESETS = [1, 2, 3, 5, 10];
const CURRENCY_OPTIONS: { code: AlertCurrencyCode; label: string }[] = [
  { code: 'TRY', label: 'TRY (₺)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
];

export function PriceAlertModal({ isOpen, onClose, stock }: PriceAlertModalProps) {
  const { showToast } = useToast();
  const { items, setAlert, removeAlert } = useWatchlistStore();
  const { user, profile } = useAuth();
  const [showProModal, setShowProModal] = useState(false);

  const isPro = Boolean(
    user?.app_metadata?.plan === 'pro' ||
    user?.app_metadata?.is_pro === true ||
    profile?.isPro
  );

  const activeAlertsCount = items.filter(
    (i) => (i.targetPrice || i.alertPercent) && i.symbol.toUpperCase() !== stock?.symbol?.toUpperCase()
  ).length;
  const existingItem = stock
    ? items.find((i) => i.symbol.toUpperCase() === stock.symbol.toUpperCase())
    : null;
  const hasExistingAlert = Boolean(existingItem?.targetPrice || existingItem?.alertPercent);
  const isLimitReached = !isPro && activeAlertsCount >= 3 && !hasExistingAlert;

  const nativeCurrency = inferAssetAlertCurrency({
    currency: stock?.currency,
    exchange: stock?.exchange,
    assetType: stock?.assetType,
    symbol: stock?.symbol,
  });
  const priceDecimals = stock?.assetType === 'fund' || (stock?.price ?? 0) < 1 ? 4 : 2;

  const [mode, setMode] = useState<AlertThresholdMode>('percent');
  const [direction, setDirection] = useState<AlertDirection>('up');
  const [selectedCurrency, setSelectedCurrency] = useState<AlertCurrencyCode>(nativeCurrency);
  const [selectedPercent, setSelectedPercent] = useState<number>(2);
  const [customPercent, setCustomPercent] = useState<string>('');
  const [targetPriceInput, setTargetPriceInput] = useState<string>('');
  const [indicatorKind, setIndicatorKind] = useState<IndicatorAlertKind>('rsi_below');
  const [indicatorThreshold, setIndicatorThreshold] = useState<number>(30);

  const currentPrice = stock?.price || 0;

  // Initialize form state when modal opens or stock changes
  useEffect(() => {
    if (!stock || !isOpen) return;

    const inferredCurr = inferAssetAlertCurrency({
      currency: stock.currency,
      exchange: stock.exchange,
      assetType: stock.assetType,
      symbol: stock.symbol,
    });
    setSelectedCurrency(existingItem?.alertCurrency || inferredCurr);

    const stockCurrentPrice = stock.price || 0;
    if (existingItem?.alertType?.startsWith('indicator_')) {
      setMode('indicator');
      const kind = existingItem.alertType.replace('indicator_', '') as IndicatorAlertKind;
      setIndicatorKind(kind);
      if (existingItem.targetPrice) {
        setIndicatorThreshold(existingItem.targetPrice);
      }
    } else if (existingItem?.alertType && existingItem.alertType !== 'price' && existingItem.alertPercent) {
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
      setDirection(
        existingItem.alertDirection === 'down' || existingItem.alertDirection === 'up'
          ? existingItem.alertDirection
          : existingItem.targetPrice >= stockCurrentPrice
            ? 'up'
            : 'down',
      );
    } else {
      setMode('percent');
      setDirection('up');
      setSelectedPercent(2);
      setCustomPercent('');
      const decimals = stock.assetType === 'fund' || stockCurrentPrice < 1 ? 4 : 2;
      setTargetPriceInput(
        stockCurrentPrice > 0 ? (stockCurrentPrice * 1.02).toFixed(decimals) : ''
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

    if (isLimitReached) {
      showToast({
        type: 'warning',
        title: 'Fiyat Alarmı Kotası Doldu',
        message: 'Standart hesaplar en fazla 3 aktif alarm kurabilir. Sınırsız alarm için Pro\'ya geçin.',
      });
      setShowProModal(true);
      return;
    }

    const built = buildQuickAlertConfig({
      symbol: stock.symbol,
      name: stock.name,
      currentPrice,
      assetType: stock.assetType || 'stock',
      nativeCurrency,
      selectedCurrency,
      mode,
      direction,
      percentValue: activePercent,
      targetPriceInput,
      indicatorKind,
      indicatorThreshold,
    });

    if (!built.ok) {
      showToast({
        type: 'danger',
        title: built.errorTitle,
        message: built.errorMessage,
      });
      return;
    }

    const descriptionText = built.descriptionText;

    setAlert(
      stock.symbol,
      {
        targetPrice: built.targetPrice,
        alertType: built.alertType,
        alertPercent: built.alertPercent,
        alertBasePrice: built.alertBasePrice,
        alertCurrency: built.alertCurrency,
        alertDirection: built.alertDirection,
      },
      {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        changePercent: stock.changePercent || 0,
        exchange: stock.exchange || (stock.assetType === 'fund' ? 'TEFAS' : 'BIST'),
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
        {/* Quota & Plan Indicator */}
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-text-muted">Alarm Kotası:</span>
          {isPro ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <UIIcon name="sparkles" className="w-3 h-3" />
              Sınırsız (StockMind Pro)
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full border ${
                isLimitReached
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-bg-secondary text-text-secondary border-border'
              }`}
            >
              <span>{activeAlertsCount} / 3 Aktif Alarm</span>
              {isLimitReached && <span className="font-bold text-rose-400"> (Dolu)</span>}
            </span>
          )}
        </div>

        {/* Limit reached warning banner */}
        {isLimitReached && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start justify-between gap-3 animate-fade-in">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                <UIIcon name="sparkles" className="w-4 h-4" />
                <span>Standart Hesap Sınırı (3 Alarm)</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-snug">
                Standart hesaplarda en fazla 3 aktif alarm tutulabilir. Mevcut bir alarmı silerek yer açabilir veya Pro&apos;ya geçerek sınırsız alarm kurabilirsiniz.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProModal(true)}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-[11px] hover:bg-amber-400 transition-colors cursor-pointer shadow-sm shadow-amber-500/20"
            >
              Pro&apos;ya Geç
            </button>
          </div>
        )}

        {/* Stock Summary Header */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-bg-secondary/70 border border-border">
          <div className="min-w-0">
            <span className="text-xs text-text-muted truncate block">{stock.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-bold text-base text-text-primary font-mono">
                {formatAlertPrice(currentPrice, nativeCurrency, stock.assetType)}
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
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-accent/15 text-accent border border-accent/20">
              {stock.assetType === 'fund' ? 'TEFAS Değerleme' : 'Canlı Fiyat'}
            </span>
            <span className="text-[10px] font-mono text-text-muted">
              Para Birimi: {nativeCurrency} ({getAlertCurrencySymbol(nativeCurrency)})
            </span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 p-1 rounded-xl bg-bg-secondary border border-border text-xs font-semibold">
          <button
            type="button"
            data-testid="alert-mode-percent"
            onClick={() => setMode('percent')}
            className={`py-2 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              mode === 'percent'
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span><UIIcon name="chart" className="w-4 h-4" /></span>
            <span className="truncate">Yüzde (%)</span>
          </button>
          <button
            type="button"
            data-testid="alert-mode-price"
            onClick={() => {
              setMode('price');
              if (direction === 'both') {
                setDirection(fixedPriceNum > 0 && fixedPriceNum < currentPrice ? 'down' : 'up');
              }
            }}
            className={`py-2 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              mode === 'price'
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span><UIIcon name="sparkles" className="w-4 h-4" /></span>
            <span className="truncate">Hedef Fiyat</span>
          </button>
          <button
            type="button"
            data-testid="alert-mode-indicator"
            onClick={() => setMode('indicator')}
            className={`py-2 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              mode === 'indicator'
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span><UIIcon name="chart" className="w-4 h-4" /></span>
            <span className="truncate">Gösterge</span>
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
                <span className="text-text-muted">Tetiklenme Eşik Fiyatı ({nativeCurrency}):</span>
                <span className="font-mono font-extrabold text-sm text-accent">
                  {direction === 'both' ? (
                    <>
                      {formatAlertPrice(currentPrice * (1 - activePercent / 100), nativeCurrency, stock.assetType)} — {formatAlertPrice(currentPrice * (1 + activePercent / 100), nativeCurrency, stock.assetType)}
                    </>
                  ) : (
                    formatAlertPrice(computedPercentTargetPrice, nativeCurrency, stock.assetType)
                  )}
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {direction === 'up' && (
                  <> {stock.symbol} fiyatı {formatAlertPrice(currentPrice, nativeCurrency, stock.assetType)} seviyesinden <strong>%+{activePercent}</strong> yükselerek <strong>{formatAlertPrice(computedPercentTargetPrice, nativeCurrency, stock.assetType)}</strong> seviyesine ulaştığında alarm çalar.</>
                )}
                {direction === 'down' && (
                  <> {stock.symbol} fiyatı {formatAlertPrice(currentPrice, nativeCurrency, stock.assetType)} seviyesinden <strong>%-{activePercent}</strong> gerileyerek <strong>{formatAlertPrice(computedPercentTargetPrice, nativeCurrency, stock.assetType)}</strong> seviyesine düştüğünde alarm çalar.</>
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
            {/* Explicit Currency Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-text-secondary">
                  Eşik Para Birimi
                </label>
                <span className="text-[10px] text-text-muted">
                  Varlık birimi: <strong className="text-text-primary">{nativeCurrency}</strong>
                </span>
              </div>
              <div data-testid="alert-currency-selector" className="grid grid-cols-3 gap-2">
                {CURRENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    aria-pressed={selectedCurrency === opt.code}
                    onClick={() => setSelectedCurrency(opt.code)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      selectedCurrency === opt.code
                        ? 'border-accent bg-accent/15 text-accent shadow-sm'
                        : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedCurrency !== nativeCurrency && (
                <p className="mt-1.5 text-[11px] text-warning bg-warning/10 border border-warning/25 rounded-lg px-2.5 py-1.5">
                  Bu varlık <strong>{nativeCurrency}</strong> cinsinden fiyatlanır. Sabit fiyat eşiği için {nativeCurrency} seçin veya yüzdesel eşiği kullanın.
                </p>
              )}
            </div>

            {/* Explicit Direction Selector for Fixed Price */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Tetiklenme Yönü
              </label>
              <div data-testid="alert-fixed-direction" className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('up')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    direction !== 'down'
                      ? 'border-success bg-success/15 text-success shadow-sm'
                      : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                  }`}
                >
                  Yukarı Kırılım (&ge;)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('down')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    direction === 'down'
                      ? 'border-danger bg-danger/15 text-danger shadow-sm'
                      : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                  }`}
                >
                  Aşağı Düşüş (&le;)
                </button>
              </div>
            </div>

            <Input
              label={`Hedef Fiyat (${getAlertCurrencySymbol(selectedCurrency)})`}
              type="number"
              step={stock.assetType === 'fund' ? '0.0001' : '0.01'}
              value={targetPriceInput}
              onChange={(e) => {
                const next = e.target.value;
                setTargetPriceInput(next);
                const parsed = Number(next);
                if (Number.isFinite(parsed) && parsed > 0 && currentPrice > 0) {
                  setDirection(parsed >= currentPrice ? 'up' : 'down');
                }
              }}
              required
              helperText={`Anlık Fiyat: ${formatAlertPrice(currentPrice, nativeCurrency, stock.assetType)}`}
              placeholder={`Örn: ${(currentPrice > 0 ? currentPrice * 1.05 : 100).toFixed(priceDecimals)}`}
            />

            {fixedPriceNum > 0 && currentPrice > 0 && selectedCurrency === nativeCurrency && (
              <div className="p-3 rounded-2xl bg-bg-secondary border border-border text-xs flex items-center justify-between">
                <span className="text-text-muted">Fiyat Farkı:</span>
                <span
                  className={`font-mono font-bold ${
                    fixedPriceDiffPercent >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {fixedPriceDiffPercent >= 0 ? '+' : ''}
                  {fixedPriceDiffPercent.toFixed(2)}% ({direction === 'down' ? 'Aşağı yönlü' : 'Yukarı yönlü'})
                </span>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: TECHNICAL INDICATOR */}
        {mode === 'indicator' && (
          <div className="space-y-3 animate-fade-in" data-testid="alert-indicator-panel">
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Teknik Gösterge Kuralı
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIndicatorKind('rsi_below');
                  setIndicatorThreshold(30);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  indicatorKind === 'rsi_below'
                    ? 'border-accent bg-accent/15 text-text-primary shadow-sm'
                    : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-text-primary">
                    RSI(14) &lt; {indicatorKind === 'rsi_below' ? indicatorThreshold : 30}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                    Aşırı Satım
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  Fiyat aşırı satım bölgesine indiğinde tepki alımı takibi için uyarır.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIndicatorKind('rsi_above');
                  setIndicatorThreshold(70);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  indicatorKind === 'rsi_above'
                    ? 'border-accent bg-accent/15 text-text-primary shadow-sm'
                    : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-text-primary">
                    RSI(14) &gt; {indicatorKind === 'rsi_above' ? indicatorThreshold : 70}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold">
                    Aşırı Alım
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  Fiyat aşırı alım bölgesine ulaştığında kâr satışı takibi için uyarır.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIndicatorKind('sma_cross_above')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  indicatorKind === 'sma_cross_above'
                    ? 'border-accent bg-accent/15 text-text-primary shadow-sm'
                    : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-text-primary">SMA 20/50 Kesişimi</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">
                    Golden Cross
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  SMA(20) hareketli ortalaması SMA(50)&apos;yi yukarı kestiğinde güçlü alım sinyali.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIndicatorKind('sma_cross_below')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  indicatorKind === 'sma_cross_below'
                    ? 'border-accent bg-accent/15 text-text-primary shadow-sm'
                    : 'border-border bg-bg-card hover:bg-bg-secondary text-text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-text-primary">SMA 20/50 Kesişimi</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold">
                    Death Cross
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  SMA(20) hareketli ortalaması SMA(50)&apos;yi aşağı kestiğinde düzeltme/satış sinyali.
                </p>
              </button>
            </div>

            {(indicatorKind === 'rsi_below' || indicatorKind === 'rsi_above') && (
              <div className="p-3 rounded-xl bg-bg-secondary border border-border">
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  RSI Eşik Değeri
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={indicatorThreshold}
                    onChange={(e) => setIndicatorThreshold(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                  <span className="font-mono font-bold text-sm text-text-primary min-w-[36px] text-right">
                    {indicatorThreshold}
                  </span>
                </div>
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
            <Button
              type="submit"
              variant={isLimitReached ? 'secondary' : 'primary'}
              size="sm"
              className="font-bold"
            >
              {isLimitReached ? (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <UIIcon name="sparkles" className="w-3.5 h-3.5" />
                  <span>Pro ile Kur</span>
                </span>
              ) : hasExistingAlert ? (
                'Alarmı Güncelle'
              ) : (
                'Alarmı Kur'
              )}
            </Button>
          </div>
        </div>
      </form>

      <ProRequestModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
      />
    </Modal>
  );
}

export default PriceAlertModal;
