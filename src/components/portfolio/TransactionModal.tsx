'use client';

import React, { useState } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Modal, Input, Button, Select, useToast } from '@/components/ui';
import { POPULAR_STOCKS } from '@/lib/data/stocks';
import { TEFAS_FUNDS } from '@/lib/data/funds';
import { cleanSymbol } from '@/lib/utils/symbol';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose }) => {
  const { addTransaction, activePortfolioId, livePrices } = usePortfolioStore();
  const { showToast } = useToast();

  const [assetType, setAssetType] = useState<'stock' | 'fund'>('stock');
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
  const [currency, setCurrency] = useState<'TRY' | 'USD'>('TRY');
  const [exchangeRate, setExchangeRate] = useState<string>('38.50');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [price, setPrice] = useState<string>('');
  const [commission, setCommission] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const liveUsdRate =
    (typeof livePrices?.['USDTRY'] === 'object' ? livePrices['USDTRY']?.price : typeof livePrices?.['USDTRY'] === 'number' ? livePrices['USDTRY'] : 0) ||
    (typeof livePrices?.['USD'] === 'object' ? livePrices['USD']?.price : typeof livePrices?.['USD'] === 'number' ? livePrices['USD'] : 0) ||
    38.5;

  const handleSymbolChange = async (sym: string) => {
    setSymbol(sym);
    const { symbol: cleanSym, assetType: detectedType, exchange } = cleanSymbol(sym);
    if (detectedType === 'fund') {
      setAssetType('fund');
      setCurrency('TRY');
    } else if (exchange === 'NASDAQ' || exchange === 'NYSE') {
      setCurrency('USD');
      setExchangeRate(liveUsdRate.toFixed(2));
    }

    if (cleanSym.length >= 3) {
      if (assetType === 'fund' || detectedType === 'fund') {
        try {
          const res = await fetch(`/api/funds/${encodeURIComponent(cleanSym)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data && json.data.price > 0) {
              setPrice(json.data.price.toString());
              return;
            }
          }
        } catch (e) {
          // ignore
        }
      } else {
        try {
          const res = await fetch(`/api/stocks/${encodeURIComponent(cleanSym)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data && (json.data.price > 0 || json.data.basePrice > 0)) {
              setPrice((json.data.price || json.data.basePrice).toString());
              if (json.data.currency === 'USD') {
                setCurrency('USD');
                setExchangeRate(liveUsdRate.toFixed(2));
              }
              return;
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !price || !quantity) {
      showToast({ type: 'danger', title: 'Hata', message: 'Lütfen tüm zorunlu alanları doldurun.' });
      return;
    }

    const { symbol: cleanSym, assetType: detectedType, exchange: detectedEx } = cleanSymbol(symbol);
    const finalType = assetType || detectedType;
    const finalEx =
      finalType === 'fund'
        ? 'TEFAS'
        : POPULAR_STOCKS.find((s) => s.symbol.toUpperCase() === cleanSym.toUpperCase())?.exchange || detectedEx || (currency === 'USD' ? 'NASDAQ' : 'BIST');

    const fxRateNum = currency === 'USD' ? Number(exchangeRate) || liveUsdRate : 1.0;

    addTransaction({
      portfolioId: activePortfolioId,
      symbol: cleanSym,
      assetType: finalType,
      transactionType,
      quantity: Number(quantity),
      price: Number(price),
      currency,
      exchangeRate: currency === 'USD' ? fxRateNum : undefined,
      commission: Number(commission),
      transactionDate: date,
      exchange: finalEx as any,
      notes: notes || null,
    });

    showToast({
      type: 'success',
      title: 'İşlem Başarıyla Eklendi',
      message: `${quantity} adet ${cleanSym} işlemi portföyünüze kaydedildi.`,
    });

    onClose();
  };

  const isUsd = currency === 'USD';
  const fx = Number(exchangeRate) || liveUsdRate;
  const rawTotal = Number(price || 0) * (quantity || 0) + (commission || 0);
  const totalInTry = isUsd ? rawTotal * fx : rawTotal;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Yeni Portföy İşlemi Ekle"
      description="Hisse senedi veya TEFAS fonu alım/satım kaydı oluşturun."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Asset Type Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-bg-secondary rounded-xl border border-border">
          <button
            type="button"
            onClick={() => {
              setAssetType('stock');
              setSymbol('');
              setPrice('');
            }}
            className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              assetType === 'stock'
                ? 'bg-accent text-white shadow'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            📈 Hisse Senedi
          </button>
          <button
            type="button"
            onClick={() => {
              setAssetType('fund');
              setSymbol('');
              setPrice('');
              setCurrency('TRY');
            }}
            className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              assetType === 'fund'
                ? 'bg-accent text-white shadow'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            🏦 TEFAS Fonu
          </button>
        </div>

        {/* Transaction Type & Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setTransactionType('buy')}
              className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                transactionType === 'buy'
                  ? 'bg-success/20 border border-success text-success'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              + Alış
            </button>
            <button
              type="button"
              onClick={() => setTransactionType('sell')}
              className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                transactionType === 'sell'
                  ? 'bg-danger/20 border border-danger text-danger'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              - Satış
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setCurrency('TRY')}
              className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                currency === 'TRY'
                  ? 'bg-accent text-white shadow'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              ₺ TRY
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrency('USD');
                setExchangeRate(liveUsdRate.toFixed(2));
              }}
              className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                currency === 'USD'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              $ USD
            </button>
          </div>
        </div>

        {/* Quick Symbol Select or Input */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            {assetType === 'stock' ? 'Hisse Sembolü' : 'Fon Kodu'}
          </label>
          <select
            value={symbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            className="w-full bg-bg-input text-text-primary text-sm rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none"
            required
          >
            <option value="">Seçiniz...</option>
            {assetType === 'stock'
              ? POPULAR_STOCKS.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — {s.name} ({s.currency === 'USD' ? '$' : '₺'} {s.exchange})
                  </option>
                ))
              : TEFAS_FUNDS.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} — {f.name}
                  </option>
                ))}
          </select>
        </div>

        {/* Price, FX Rate & Quantity */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Birim Fiyat (${currency === 'USD' ? '$' : '₺'})`}
            type="number"
            step="0.000001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Input
            label="Adet / Lot"
            type="number"
            min="0.0001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </div>

        {/* If USD is selected, show FX rate */}
        {isUsd && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <Input
              label="İşlem Kuru (USD/TRY)"
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              helperText={`Anlık kur: 1 USD = ₺${liveUsdRate.toFixed(2)} (Geçmiş işlem kurunuzu girebilirsiniz)`}
              required
            />
          </div>
        )}

        {/* Date & Commission */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="İşlem Tarihi"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Input
            label={`Komisyon Tutarı (${currency === 'USD' ? '$' : '₺'})`}
            type="number"
            step="0.01"
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
          />
        </div>

        <Input
          label="İşlem Notu (Opsiyonel)"
          placeholder="örn: Uzun vade biriktirme"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Total Summary */}
        <div className="bg-bg-tertiary p-3.5 rounded-xl border border-border space-y-1">
          <div className="flex justify-between items-center text-xs text-text-secondary">
            <span>İşlem Tutarı:</span>
            <span className="font-mono font-semibold text-text-primary">
              {isUsd ? '$' : '₺'}
              {rawTotal.toLocaleString(isUsd ? 'en-US' : 'tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {isUsd && (
            <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-border/40 text-emerald-400">
              <span>TL Portföy Karşılığı (@ {fx.toFixed(2)}):</span>
              <span className="font-mono">
                ₺{totalInTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button type="submit" variant="primary">
            İşlemi Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
};
