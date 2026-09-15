'use client';

import React, { useState } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Modal, Input, Button, Select, useToast } from '@/components/ui';
import { POPULAR_STOCKS } from '@/lib/data/stocks';
import { TEFAS_FUNDS } from '@/lib/data/funds';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose }) => {
  const { addTransaction, activePortfolioId } = usePortfolioStore();
  const { showToast } = useToast();

  const [assetType, setAssetType] = useState<'stock' | 'fund'>('stock');
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [price, setPrice] = useState<string>('');
  const [commission, setCommission] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const handleSymbolChange = (sym: string) => {
    setSymbol(sym);
    if (assetType === 'stock') {
      const stock = POPULAR_STOCKS.find((s) => s.symbol.toUpperCase() === sym.toUpperCase());
      if (stock) {
        setPrice(stock.basePrice.toString());
      }
    } else {
      const fund = TEFAS_FUNDS.find((f) => f.code.toUpperCase() === sym.toUpperCase());
      if (fund) {
        setPrice(fund.price.toString());
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !price || !quantity) {
      showToast({ type: 'danger', title: 'Hata', message: 'Lütfen tüm zorunlu alanları doldurun.' });
      return;
    }

    const exchange =
      assetType === 'fund'
        ? 'TEFAS'
        : POPULAR_STOCKS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase())?.exchange || 'BIST';

    addTransaction({
      portfolioId: activePortfolioId,
      symbol: symbol.toUpperCase(),
      assetType,
      transactionType,
      quantity: Number(quantity),
      price: Number(price),
      commission: Number(commission),
      transactionDate: date,
      exchange: exchange as any,
      notes: notes || null,
    });

    showToast({
      type: 'success',
      title: 'İşlem Başarıyla Eklendi',
      message: `${quantity} adet ${symbol.toUpperCase()} işlemi portföyünüze kaydedildi.`,
    });

    onClose();
  };

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

        {/* Transaction Type */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTransactionType('buy')}
            className={`py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
              transactionType === 'buy'
                ? 'bg-success/20 border-success text-success'
                : 'bg-bg-tertiary border-border text-text-muted'
            }`}
          >
            + Alış (BUY)
          </button>
          <button
            type="button"
            onClick={() => setTransactionType('sell')}
            className={`py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
              transactionType === 'sell'
                ? 'bg-danger/20 border-danger text-danger'
                : 'bg-bg-tertiary border-border text-text-muted'
            }`}
          >
            - Satış (SELL)
          </button>
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

        {/* Price & Quantity in 2 columns */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Birim Fiyat (₺)"
            type="number"
            step="0.0001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Input
            label="Adet / Lot"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </div>

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
            label="Komisyon Tutarı (₺)"
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
        <div className="bg-bg-tertiary p-3 rounded-xl border border-border flex justify-between items-center text-sm">
          <span className="text-text-secondary">Toplam Tutar:</span>
          <span className="font-bold font-mono text-text-primary">
            ₺
            {(Number(price || 0) * (quantity || 0) + (commission || 0)).toLocaleString('tr-TR', {
              minimumFractionDigits: 2,
            })}
          </span>
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
