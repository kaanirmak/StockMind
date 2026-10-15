'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Modal, Input, Button, useToast } from '@/components/ui';
import { CashPanel } from './CashPanel';
import { BrokerDirectory } from './BrokerDirectory';
import { cleanSymbol } from '@/lib/utils/symbol';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentation?: 'dialog' | 'sheet' | 'drawer';
  initialSymbol?: string;
  initialMode?: 'broker' | 'stock' | 'fund' | 'cash';
}

const POPULAR_STOCK_CHIPS = [
  { symbol: 'THYAO', name: 'Türk Hava Yolları', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'GARAN', name: 'Garanti BBVA', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'ASELS', name: 'Aselsan', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'EREGL', name: 'Ereğli Demir Çelik', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'TUPRS', name: 'Tüpraş', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'KCHOL', name: 'Koç Holding', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'ASTOR', name: 'Astor Enerji', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'KONTR', name: 'Kontrolmatik', exchange: 'BIST', currency: 'TRY' },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'GRAM_ALTIN', name: 'Gram Altın', exchange: 'BIST', currency: 'TRY' },
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  presentation = 'dialog',
  initialSymbol,
  initialMode = 'stock',
}) => {
  const { addTransaction, activePortfolioId, livePrices } = usePortfolioStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'broker' | 'stock' | 'fund' | 'cash'>(initialMode);
  const [cashMode, setCashMode] = useState(initialMode === 'cash');
  const [cashBusy, setCashBusy] = useState(false);
  const [assetType, setAssetType] = useState<'stock' | 'fund'>(initialMode === 'fund' ? 'fund' : 'stock');
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
  const [currency, setCurrency] = useState<'TRY' | 'USD'>('TRY');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [symbol, setSymbol] = useState(initialSymbol || '');
  const [searchQuery, setSearchQuery] = useState(initialSymbol || '');
  const [quantity, setQuantity] = useState<number>(100);
  const [price, setPrice] = useState<string>('');
  const [commission, setCommission] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchResults, setSearchResults] = useState<{
    stocks: any[];
    funds: any[];
    loading: boolean;
  }>({ stocks: [], funds: [], loading: false });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const usdQuote = livePrices?.['USDTRY'] || livePrices?.['USD'];
  const liveUsdRate =
    typeof usdQuote === 'number' && usdQuote > 0
      ? usdQuote
      : usdQuote && typeof usdQuote === 'object' && Number.isFinite(usdQuote.price) && usdQuote.price > 0
      ? usdQuote.price
      : null;

  useEffect(() => {
    if (liveUsdRate && !exchangeRate) {
      setExchangeRate(liveUsdRate.toFixed(2));
    }
  }, [liveUsdRate]);

  useEffect(() => {
    if (isOpen) {
      if (initialSymbol) {
        setSymbol(initialSymbol.toUpperCase().trim());
        setSearchQuery(initialSymbol.toUpperCase().trim());
      }
      if (initialMode) {
        setActiveTab(initialMode);
        if (initialMode === 'cash') {
          setCashMode(true);
        } else if (initialMode === 'stock' || initialMode === 'fund') {
          setCashMode(false);
          setAssetType(initialMode);
        } else {
          setCashMode(false);
        }
      }
    }
  }, [isOpen, initialSymbol, initialMode]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search effect with debounce across all stocks and funds
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ stocks: [], funds: [], loading: false });
      return;
    }

    const timer = setTimeout(async () => {
      setSearchResults((prev) => ({ ...prev, loading: true }));
      try {
        if (assetType === 'stock') {
          const res = await fetch(`/api/stocks?search=${encodeURIComponent(searchQuery.trim())}`);
          const data = await res.json();
          setSearchResults({
            stocks: data.success && Array.isArray(data.data) ? data.data.slice(0, 10) : [],
            funds: [],
            loading: false,
          });
        } else {
          const res = await fetch(`/api/funds?search=${encodeURIComponent(searchQuery.trim())}`);
          const data = await res.json();
          setSearchResults({
            stocks: [],
            funds: data.success && Array.isArray(data.data) ? data.data.slice(0, 10) : [],
            loading: false,
          });
        }
      } catch (err) {
        setSearchResults({ stocks: [], funds: [], loading: false });
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery, assetType]);

  const handleSelectAsset = async (item: {
    symbol?: string;
    code?: string;
    name?: string;
    price?: number;
    basePrice?: number;
    currency?: string;
    exchange?: string;
    assetType?: 'stock' | 'fund';
  }) => {
    const rawSym = item.symbol || item.code || '';
    const { symbol: cleanSym, assetType: detectedType, exchange } = cleanSymbol(rawSym);
    const sym = cleanSym.toUpperCase().trim();

    setSymbol(sym);
    setSearchQuery(sym);
    setIsDropdownOpen(false);

    const isFund = assetType === 'fund' || detectedType === 'fund' || item.assetType === 'fund';
    const isUsdAsset =
      item.currency === 'USD' ||
      exchange === 'NASDAQ' ||
      exchange === 'NYSE';

    if (isUsdAsset) {
      setCurrency('USD');
      if (liveUsdRate) setExchangeRate(liveUsdRate.toFixed(2));
    } else {
      setCurrency('TRY');
    }

    // Set price if already provided
    if (item.price && item.price > 0) {
      setPrice(item.price.toString());
      return;
    }
    if (item.basePrice && item.basePrice > 0) {
      setPrice(item.basePrice.toString());
      return;
    }

    // Otherwise fetch live price via API
    setIsFetchingPrice(true);
    try {
      if (isFund) {
        const res = await fetch(`/api/funds/${encodeURIComponent(sym)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && json.data.price > 0) {
            setPrice(json.data.price.toString());
          }
        }
      } else {
        const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const p = json.data.price || json.data.basePrice;
            if (p > 0) setPrice(p.toString());
            if (json.data.currency === 'USD') {
              setCurrency('USD');
              if (liveUsdRate) setExchangeRate(liveUsdRate.toFixed(2));
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live price:', e);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleManualSymbolBlur = async () => {
    if (!symbol || symbol.length < 2) return;
    const { symbol: cleanSym, assetType: detectedType, exchange } = cleanSymbol(symbol);
    if (detectedType === 'fund') {
      setAssetType('fund');
      setCurrency('TRY');
    } else if (exchange === 'NASDAQ' || exchange === 'NYSE') {
      setCurrency('USD');
      if (liveUsdRate) setExchangeRate(liveUsdRate.toFixed(2));
    }

    setIsFetchingPrice(true);
    try {
      if (assetType === 'fund' || detectedType === 'fund') {
        const res = await fetch(`/api/funds/${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.price > 0) {
            setPrice(json.data.price.toString());
          }
        }
      } else {
        const res = await fetch(`/api/stocks/${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const p = json.data.price || json.data.basePrice;
            if (p > 0) setPrice(p.toString());
            if (json.data.currency === 'USD') {
              setCurrency('USD');
              if (liveUsdRate) setExchangeRate(liveUsdRate.toFixed(2));
            }
          }
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !price || !quantity) {
      showToast({ type: 'danger', title: 'Eksik Alan', message: 'Lütfen tüm zorunlu alanları doldurun.' });
      return;
    }

    const numQty = Number(quantity);
    const numPrice = Number(price);

    if (numQty <= 0 || numPrice <= 0) {
      showToast({ type: 'danger', title: 'Geçersiz Değer', message: 'Miktar ve birim fiyat sıfırdan büyük olmalıdır.' });
      return;
    }

    const { symbol: cleanSym, assetType: detectedType, exchange: detectedEx } = cleanSymbol(symbol);

    // FIN-05: Prevent short selling / selling more than currently owned in active portfolio
    if (transactionType === 'sell') {
      const summary = usePortfolioStore.getState().getSummary();
      const existingHolding = summary.holdings.find(
        (h) => h.symbol.toUpperCase() === cleanSym.toUpperCase()
      );
      const availableQty = existingHolding?.totalQuantity || 0;
      if (availableQty <= 0) {
        showToast({
          type: 'danger',
          title: 'Varlık Bulunamadı',
          message: `Portföyünüzde hiç ${cleanSym} bulunmamaktadır. Satış işlemi yapamazsınız.`,
        });
        return;
      }
      if (numQty > availableQty) {
        showToast({
          type: 'danger',
          title: 'Yetersiz Miktar',
          message: `Portföyünüzde ${availableQty} adet ${cleanSym} bulunmaktadır. ${numQty} adet satamazsınız.`,
        });
        return;
      }
    }

    const finalType = assetType || detectedType;
    const finalEx =
      finalType === 'fund'
        ? 'TEFAS'
        : POPULAR_STOCK_CHIPS.find((s) => s.symbol.toUpperCase() === cleanSym.toUpperCase())?.exchange ||
          detectedEx ||
          (currency === 'USD' ? 'NASDAQ' : 'BIST');

    const fxRateNum = currency === 'USD' ? Number(exchangeRate) || liveUsdRate || 1.0 : 1.0;

    setIsSubmitting(true);
    try {
      const savedTx = await addTransaction({
        portfolioId: activePortfolioId,
        symbol: cleanSym,
        assetType: finalType,
        transactionType,
        quantity: numQty,
        price: numPrice,
        currency,
        exchangeRate: currency === 'USD' ? fxRateNum : undefined,
        commission: Number(commission) || 0,
        transactionDate: date,
        exchange: finalEx as any,
        notes: notes || null,
      });

      if (!savedTx) {
        showToast({
          type: 'danger',
          title: 'Kayıt Başarısız',
          message: 'İşlem sunucuya kaydedilemedi. Lütfen internet bağlantınızı kontrol edin.',
        });
        return;
      }

      showToast({
        type: 'success',
        title: 'İşlem Başarıyla Eklendi',
        message: `${numQty} adet ${cleanSym} ${transactionType === 'buy' ? 'alımı' : 'satışı'} portföyünüze kaydedildi.`,
      });

      // Reset form & close
      setSymbol('');
      setSearchQuery('');
      setPrice('');
      setNotes('');
      onClose();
    } catch (err: any) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: err.message || 'İşlem kaydedilirken bir hata oluştu.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUsd = currency === 'USD';
  const fx = Number(exchangeRate) || liveUsdRate || 1.0;
  const rawTotal = Number(price || 0) * (quantity || 0) + (commission || 0);
  const totalInTry = isUsd ? rawTotal * fx : rawTotal;

  const modalTitle =
    activeTab === 'broker'
      ? (symbol ? `${symbol} — İşlem Yap (Midas & Kurumlar)` : 'İşlem Yap — Aracı Kurum Seçimi')
      : activeTab === 'cash'
      ? 'Nakit Yönetimi'
      : 'Portföy İşlemi Ekle';

  return (
    <Modal
      presentation={presentation}
      isOpen={isOpen}
      onClose={() => { if (!cashBusy && !isSubmitting) onClose(); }}
      title={modalTitle}
      size="md"
    >
      <div className="grid grid-cols-4 gap-1 mb-4 rounded-xl bg-bg-secondary p-1" role="group" aria-label="İşlem kategorisi">
        {(['broker', 'stock', 'fund', 'cash'] as const).map((type) => (
          <button
            type="button"
            key={type}
            disabled={cashBusy || isSubmitting}
            aria-pressed={activeTab === type}
            onClick={() => {
              setActiveTab(type);
              if (type === 'cash') {
                setCashMode(true);
              } else {
                setCashMode(false);
                if (type === 'stock' || type === 'fund') {
                  if (assetType !== type) {
                    setAssetType(type);
                    setSymbol('');
                    setSearchQuery('');
                    setPrice('');
                    if (type === 'fund') setCurrency('TRY');
                  }
                }
              }
            }}
            className={`min-h-11 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === type
                ? 'bg-bg-card text-text-primary shadow-sm border border-border/60'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {type === 'broker' ? '⚡ Midas' : type === 'stock' ? 'Hisse' : type === 'fund' ? 'Fon' : 'Nakit'}
          </button>
        ))}
      </div>
      {activeTab === 'broker' ? (
        <BrokerDirectory
          selectedSymbol={symbol}
          onSelectBroker={(b) => {
            const symText = symbol ? `${symbol} için ` : '';
            showToast({
              type: 'info',
              title: `${b.shortName}'a Yönlendiriliyorsunuz`,
              message: `${symText}${b.name} açılıyor...`,
            });
            window.open(b.url, '_blank', 'noopener,noreferrer');
            onClose();
          }}
        />
      ) : activeTab === 'cash' ? (
        <CashPanel embedded onComplete={onClose} onBusyChange={setCashBusy} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 block text-xs text-text-secondary">İşlem türü<select aria-label="İşlem türü" value={transactionType} onChange={e => setTransactionType(e.target.value as 'buy' | 'sell')} className="block w-full h-11 px-3 rounded-xl bg-bg-input border border-border text-text-primary"><option value="buy">Alış</option><option value="sell">Satış</option></select></label>
          <label className="space-y-1 block text-xs text-text-secondary">Para birimi<select aria-label="Para birimi" value={currency} onChange={e => { setCurrency(e.target.value as 'TRY' | 'USD'); if (e.target.value === 'USD' && liveUsdRate) setExchangeRate(liveUsdRate.toFixed(2)); }} className="block w-full h-11 px-3 rounded-xl bg-bg-input border border-border text-text-primary"><option value="TRY">TRY · Türk Lirası</option><option value="USD">USD · ABD Doları</option></select></label>
        </div>

        {/* Searchable Symbol Input with Autocomplete */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-text-secondary">
              {assetType === 'stock' ? 'Hisse Sembolü veya Şirket Adı' : 'TEFAS Fon Kodu veya Fon Adı'}
            </label>
            {isFetchingPrice && (
              <span className="text-[11px] text-accent flex items-center gap-1 animate-pulse">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fiyat sorgulanıyor...
              </span>
            )}
          </div>

          <div className="relative">
            <input
              aria-label={assetType === 'stock' ? 'Hisse ara' : 'Fon ara'}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                setSymbol(val.toUpperCase().trim());
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={handleManualSymbolBlur}
              placeholder={
                assetType === 'stock'
                  ? 'Hisse kodu veya şirket adı'
                  : 'Fon kodu veya adı'
              }
              className="w-full bg-bg-input text-text-primary font-mono text-sm rounded-xl border border-border px-3.5 py-2.5 pl-10 focus:border-accent focus:outline-none"
              required
            />
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>

          {/* Autocomplete Dropdown List */}
          {isDropdownOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 max-h-60 overflow-y-auto space-y-1 animate-fade-in backdrop-blur-md">
              {searchResults.loading ? (
                <div className="py-4 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span>Sonuçlar aranıyor...</span>
                </div>
              ) : assetType === 'stock' ? (
                searchResults.stocks.length > 0 ? (
                  searchResults.stocks.map((s) => (
                    <button
                      key={`${s.exchange}-${s.symbol}`}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { handleSelectAsset(s); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-text-primary px-1.5 py-0.5 rounded bg-bg-tertiary group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                          {s.symbol}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{s.name}</p>
                          <p className="text-[10px] text-text-muted">{s.sector || s.exchange}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-mono font-bold text-text-primary block">
                          {s.currency === 'USD' ? '$' : '₺'}{(s.price || s.basePrice || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] font-semibold text-text-muted">{s.exchange}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-text-muted">
                    <span>Eşleşen hisse bulunamadı. </span>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { handleSelectAsset({ symbol: searchQuery.toUpperCase().trim() }); }}
                      className="text-accent hover:underline font-semibold"
                    >
                      "{searchQuery.toUpperCase()}" olarak kaydet
                    </button>
                  </div>
                )
              ) : (
                searchResults.funds.length > 0 ? (
                  searchResults.funds.map((f) => (
                    <button
                      key={f.code}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { handleSelectAsset({ code: f.code, name: f.name, price: f.price, assetType: 'fund' }); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-text-primary px-1.5 py-0.5 rounded bg-bg-tertiary group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                          {f.code}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{f.name}</p>
                          <p className="text-[10px] text-text-muted">{f.category || 'TEFAS Fonu'}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-mono font-bold text-text-primary block">
                          ₺{(f.price || 0).toFixed(4)}
                        </span>
                        <span className="text-[10px] font-semibold text-text-muted">TEFAS</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-text-muted">
                    <span>Eşleşen fon bulunamadı. </span>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { handleSelectAsset({ code: searchQuery.toUpperCase().trim(), assetType: 'fund' }); }}
                      className="text-accent hover:underline font-semibold"
                    >
                      "{searchQuery.toUpperCase()}" olarak kaydet
                    </button>
                  </div>
                )
              )}
            </div>
          )}


        </div>

        {/* Price, FX Rate & Quantity */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          <Input
            label={`Birim Fiyat (${currency === 'USD' ? '$' : '₺'})`}
            type="number"
            step="0.000001"
            placeholder="0.00"
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
              helperText={
                liveUsdRate
                  ? `Anlık kur: 1 USD = ₺${liveUsdRate.toFixed(2)} (Geçmiş işlem kurunuzu girebilirsiniz)`
                  : 'USD kuru bekleniyor (geçmiş veya güncel işlem kurunuzu girebilirsiniz)'
              }
              required
            />
          </div>
        )}

        {/* Date & Commission */}
        <div className="grid grid-cols-1 gap-2.5">
          <Input
            label="İşlem Tarihi"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <details className="rounded-xl border border-border px-3">
          <summary className="py-3 text-xs text-text-secondary cursor-pointer">Komisyon ve not ekle</summary>
          <div className="space-y-3 pb-3">
          <Input
            label={`Komisyon Tutarı (${currency === 'USD' ? '$' : '₺'})`}
            type="number"
            step="0.01"
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
          />
          <Input
          label="İşlem Notu (Opsiyonel)"
          placeholder="örn: Uzun vade biriktirme, temettü yatırımı"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

          </div>
        </details>

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
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto justify-center">
            İptal
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full sm:w-auto justify-center">
            {isSubmitting ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
          </Button>
        </div>
      </form>
    )}
  </Modal>
  );
};

