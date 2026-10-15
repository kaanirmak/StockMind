'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Modal, Input, Button, useToast } from '@/components/ui';
import { CashPanel } from './CashPanel';
import { BrokerDirectory } from './BrokerDirectory';
import { BROKERS, Broker } from '@/lib/data/brokers';
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

  // Top-level Execution Channel: 'broker' (Aracı Kurum) vs. 'virtual' (StockMind Sanal Bakiye)
  const [executionMode, setExecutionMode] = useState<'broker' | 'virtual'>(
    initialMode === 'broker' ? 'broker' : 'virtual'
  );
  // Under StockMind Sanal Bakiye: 'stock' | 'fund' | 'cash'
  const [assetSubTab, setAssetSubTab] = useState<'stock' | 'fund' | 'cash'>(
    initialMode === 'cash' ? 'cash' : initialMode === 'fund' ? 'fund' : 'stock'
  );
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

  // Spotlight unified search state
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [spotlightResults, setSpotlightResults] = useState<{
    brokers: Broker[];
    stocks: any[];
    funds: any[];
    loading: boolean;
  }>({ brokers: [], stocks: [], funds: [], loading: false });
  const spotlightContainerRef = useRef<HTMLDivElement>(null);

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
        if (initialMode === 'broker') {
          setExecutionMode('broker');
          setCashMode(false);
        } else {
          setExecutionMode('virtual');
          setAssetSubTab(initialMode);
          if (initialMode === 'cash') {
            setCashMode(true);
          } else {
            setCashMode(false);
            setAssetType(initialMode);
          }
        }
      }
    }
  }, [isOpen, initialSymbol, initialMode]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (spotlightContainerRef.current && !spotlightContainerRef.current.contains(e.target as Node)) {
        setIsSpotlightOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Spotlight search effect with instant client matching + debounced remote API queries
  useEffect(() => {
    const q = spotlightQuery.trim().toLowerCase();
    if (!q) {
      setSpotlightResults({ brokers: [], stocks: [], funds: [], loading: false });
      return;
    }

    // 1. Instant broker matches from BROKERS dataset
    const matchedBrokers = BROKERS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.badge.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    ).slice(0, 4);

    // 2. Instant popular stock matches
    const matchedPopular = POPULAR_STOCK_CHIPS.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );

    setSpotlightResults((prev) => ({
      ...prev,
      brokers: matchedBrokers,
      stocks: matchedPopular,
      loading: true,
    }));

    // 3. Debounced remote API search across stocks and TEFAS funds
    const timer = setTimeout(async () => {
      try {
        const [stocksRes, fundsRes] = await Promise.allSettled([
          fetch(`/api/stocks?search=${encodeURIComponent(q)}`).then((r) => r.json()),
          fetch(`/api/funds?search=${encodeURIComponent(q)}`).then((r) => r.json()),
        ]);

        const remoteStocks =
          stocksRes.status === 'fulfilled' && stocksRes.value?.success && Array.isArray(stocksRes.value?.data)
            ? stocksRes.value.data.slice(0, 6)
            : [];

        const remoteFunds =
          fundsRes.status === 'fulfilled' && fundsRes.value?.success && Array.isArray(fundsRes.value?.data)
            ? fundsRes.value.data.slice(0, 6)
            : [];

        const stockMap = new Map<string, any>();
        for (const s of [...matchedPopular, ...remoteStocks]) {
          const sym = (s.symbol || '').toUpperCase();
          if (sym && !stockMap.has(sym)) stockMap.set(sym, s);
        }

        setSpotlightResults({
          brokers: matchedBrokers,
          stocks: Array.from(stockMap.values()).slice(0, 6),
          funds: remoteFunds,
          loading: false,
        });
      } catch {
        setSpotlightResults((prev) => ({ ...prev, loading: false }));
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [spotlightQuery]);

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

  const handleOpenBroker = (b: Broker) => {
    const symText = symbol ? `${symbol} için ` : '';
    showToast({
      type: 'info',
      title: `${b.shortName}'a Yönlendiriliyorsunuz`,
      message: `${symText}${b.name} açılıyor...`,
    });
    window.open(b.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const modalTitle =
    executionMode === 'broker'
      ? (symbol ? `${symbol} — Aracı Kurum Seçimi` : 'İşlem Yap — Aracı Kurum Seçimi')
      : assetSubTab === 'cash'
      ? 'StockMind Sanal Nakit Yönetimi'
      : symbol
      ? `${symbol} — StockMind Sanal Portföy İşlemi`
      : 'StockMind Sanal Portföy İşlemi';

  return (
    <Modal
      presentation={presentation}
      isOpen={isOpen}
      onClose={() => { if (!cashBusy && !isSubmitting) onClose(); }}
      title={modalTitle}
      size="md"
    >
      {/* 1. Spotlight Unified Search Bar (Brokers, Stocks, Funds, Cash) */}
      <div className="relative mb-3.5" ref={spotlightContainerRef}>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 text-accent pointer-events-none flex items-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={spotlightQuery}
            onChange={(e) => {
              setSpotlightQuery(e.target.value);
              setIsSpotlightOpen(true);
            }}
            onFocus={() => setIsSpotlightOpen(true)}
            placeholder="Spotlight arama (Hisse, Fon veya Aracı Kurum)..."
            className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-bg-secondary text-text-primary text-xs sm:text-sm font-medium placeholder:text-text-muted border border-border focus:outline-hidden focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-inner"
          />
          <div className="absolute right-2.5 flex items-center gap-1.5">
            {spotlightQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSpotlightQuery('');
                  setIsSpotlightOpen(false);
                }}
                className="text-text-muted hover:text-text-primary text-xs p-1 cursor-pointer"
                title="Temizle"
              >
                ✕
              </button>
            ) : (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border/50 hidden sm:inline-block">
                Spotlight
              </span>
            )}
          </div>
        </div>

        {/* Spotlight Results Dropdown Panel */}
        {isSpotlightOpen && spotlightQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-bg-card/98 backdrop-blur-2xl border border-border/90 shadow-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-border/40 animate-scale-in">
            {spotlightResults.loading && (
              <div className="p-2.5 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span>Aranıyor...</span>
              </div>
            )}

            {/* Aracı Kurumlar Section */}
            {spotlightResults.brokers.length > 0 && (
              <div className="p-2">
                <div className="text-[10px] font-bold text-text-muted px-2 py-1 uppercase tracking-wider flex items-center justify-between">
                  <span>🏦 Aracı Kurumlar</span>
                  <span className="text-[9px] font-mono text-accent">Gerçek Al/Sat</span>
                </div>
                <div className="space-y-1">
                  {spotlightResults.brokers.map((b) => (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => {
                        setIsSpotlightOpen(false);
                        setSpotlightQuery('');
                        setExecutionMode('broker');
                        handleOpenBroker(b);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-bg-secondary transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs bg-gradient-to-br ${b.gradient}`}
                        >
                          {b.letter}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-text-primary block truncate group-hover:text-accent transition-colors">
                            {b.name}
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            {b.badge} • {b.category}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-accent shrink-0 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Aç</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hisseler Section */}
            {spotlightResults.stocks.length > 0 && (
              <div className="p-2">
                <div className="text-[10px] font-bold text-text-muted px-2 py-1 uppercase tracking-wider flex items-center justify-between">
                  <span>📈 Hisseler</span>
                  <span className="text-[9px] font-mono text-violet-400">StockMind Sanal Bakiye</span>
                </div>
                <div className="space-y-1">
                  {spotlightResults.stocks.map((s) => (
                    <button
                      type="button"
                      key={s.symbol}
                      onClick={() => {
                        setIsSpotlightOpen(false);
                        setSpotlightQuery('');
                        setExecutionMode('virtual');
                        setAssetSubTab('stock');
                        setCashMode(false);
                        setAssetType('stock');
                        handleSelectAsset({ ...s, assetType: 'stock' });
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-bg-secondary transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono font-bold text-xs shrink-0">
                          {s.symbol}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-accent transition-colors">
                            {s.name || s.symbol}
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            {s.exchange || 'BIST'} • {s.currency || 'TRY'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-text-primary shrink-0">
                        {s.price ? `${s.currency === 'USD' ? '$' : '₺'}${Number(s.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : 'Seç →'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TEFAS Fonları Section */}
            {spotlightResults.funds.length > 0 && (
              <div className="p-2">
                <div className="text-[10px] font-bold text-text-muted px-2 py-1 uppercase tracking-wider flex items-center justify-between">
                  <span>📊 TEFAS Fonları</span>
                  <span className="text-[9px] font-mono text-purple-400">StockMind Sanal Bakiye</span>
                </div>
                <div className="space-y-1">
                  {spotlightResults.funds.map((f) => (
                    <button
                      type="button"
                      key={f.code || f.symbol}
                      onClick={() => {
                        setIsSpotlightOpen(false);
                        setSpotlightQuery('');
                        setExecutionMode('virtual');
                        setAssetSubTab('fund');
                        setCashMode(false);
                        setAssetType('fund');
                        handleSelectAsset({ ...f, assetType: 'fund' });
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-bg-secondary transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono font-bold text-xs shrink-0">
                          {f.code || f.symbol}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-text-primary block truncate group-hover:text-accent transition-colors">
                            {f.name}
                          </span>
                          <span className="text-[10px] text-text-muted block truncate">
                            TEFAS Yatırım Fonu
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-text-primary shrink-0">
                        {f.price ? `₺${Number(f.price).toFixed(4)}` : 'Seç →'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Cash Option if matched */}
            {(['nakit', 'para', 'bakiye', 'cash', 'try', 'usd', 'yatır', 'çek'].some((w) => spotlightQuery.toLowerCase().includes(w))) && (
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSpotlightOpen(false);
                    setSpotlightQuery('');
                    setExecutionMode('virtual');
                    setAssetSubTab('cash');
                    setCashMode(true);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">💵</span>
                    <div>
                      <span className="text-xs font-bold block">StockMind Sanal Nakit Yönetimi</span>
                      <span className="text-[10px] text-text-muted block">Portföyünüze nakit yatırın veya çekin</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold">Nakit Paneline Git →</span>
                </button>
              </div>
            )}

            {/* Empty state if nothing found */}
            {!spotlightResults.loading &&
              spotlightResults.brokers.length === 0 &&
              spotlightResults.stocks.length === 0 &&
              spotlightResults.funds.length === 0 && (
                <div className="p-6 text-center text-xs text-text-muted">
                  <p className="font-semibold text-text-secondary">Sonuç bulunamadı</p>
                  <p className="text-[11px] mt-1">&quot;{spotlightQuery}&quot; için aracı kurum, hisse veya fon bulunamadı.</p>
                </div>
              )}
          </div>
        )}
      </div>

      {/* 2. Top-Level Execution Mode: Aracı Kurum vs. StockMind Sanal Bakiye */}
      <div className="grid grid-cols-2 p-1 mb-3.5 rounded-xl bg-bg-secondary border border-border" role="tablist" aria-label="İşlem kanalı">
        <button
          type="button"
          disabled={cashBusy || isSubmitting}
          aria-selected={executionMode === 'broker'}
          onClick={() => {
            setExecutionMode('broker');
            setCashMode(false);
          }}
          className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            executionMode === 'broker'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Aracı Kurum ile İşlem</span>
        </button>

        <button
          type="button"
          disabled={cashBusy || isSubmitting}
          aria-selected={executionMode === 'virtual'}
          onClick={() => {
            setExecutionMode('virtual');
            if (assetSubTab === 'cash') setCashMode(true);
          }}
          className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            executionMode === 'virtual'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>StockMind Sanal Bakiye</span>
        </button>
      </div>

      {/* 3. Sub-tabs under StockMind Sanal Bakiye: Hisse, TEFAS Fon, Nakit */}
      {executionMode === 'virtual' && (
        <div className="grid grid-cols-3 gap-1 mb-4 rounded-xl bg-bg-secondary/70 p-1 border border-border/50" role="group" aria-label="Varlık kategorisi">
          {(['stock', 'fund', 'cash'] as const).map((type) => (
            <button
              type="button"
              key={type}
              disabled={cashBusy || isSubmitting}
              aria-pressed={assetSubTab === type}
              onClick={() => {
                setAssetSubTab(type);
                if (type === 'cash') {
                  setCashMode(true);
                } else {
                  setCashMode(false);
                  if (assetType !== type) {
                    setAssetType(type);
                    setSymbol('');
                    setSearchQuery('');
                    setPrice('');
                    if (type === 'fund') setCurrency('TRY');
                  }
                }
              }}
              className={`min-h-10 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                assetSubTab === type
                  ? 'bg-bg-card text-text-primary shadow-xs border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>{type === 'stock' ? '📈 Hisse' : type === 'fund' ? '📊 TEFAS Fon' : '💵 Nakit'}</span>
            </button>
          ))}
        </div>
      )}

      {executionMode === 'broker' ? (
        <div className="space-y-3.5">
          <BrokerDirectory
            selectedSymbol={symbol}
            onSelectBroker={handleOpenBroker}
          />
          <div className="p-3 bg-bg-secondary/70 rounded-xl border border-dashed border-border flex items-center justify-between text-xs text-text-muted">
            <span>İşlemi gerçek aracı kurum yerine sanal portföye eklemek ister misiniz?</span>
            <button
              type="button"
              onClick={() => {
                setExecutionMode('virtual');
                setAssetSubTab('stock');
                setCashMode(false);
              }}
              className="text-accent hover:underline font-bold shrink-0 ml-2 cursor-pointer"
            >
              Sanal Portföye Ekle →
            </button>
          </div>
        </div>
      ) : assetSubTab === 'cash' ? (
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

        {/* Switch to Broker Channel Prompt */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-text-muted">
          <span>Doğrudan Midas veya bankanızla gerçek işlem yapmak için:</span>
          <button
            type="button"
            onClick={() => setExecutionMode('broker')}
            className="text-accent hover:underline font-semibold cursor-pointer shrink-0 ml-2"
          >
            Aracı Kurum Seçimine Geç →
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-1">
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

