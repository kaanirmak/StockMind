'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStockDetail, useStockHistory, useStockIndicators } from '@/hooks/useStockData';
import { CandlestickChart } from '@/components/stocks/CandlestickChart';
import { TechnicalIndicatorsPanel } from '@/components/stocks/TechnicalIndicatorsPanel';
import { Badge, Button, Modal, Input, useToast, InstrumentLogo } from '@/components/ui';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { BROKERS, Broker } from '@/lib/data/brokers';

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const resolvedParams = use(params);
  const symbol = resolvedParams.symbol.toUpperCase();
  const router = useRouter();
  const { showToast } = useToast();
  const { toggleWatchlist, isWatchlisted: checkWatchlisted } = useWatchlistStore();
  const { addTransaction, activePortfolioId, fetchLivePrices } = usePortfolioStore();

  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL'>('1Y');
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  // Buy/Sell Quick Modal & Broker Redirection
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeModalTab, setTradeModalTab] = useState<'broker' | 'virtual'>('broker');
  const [brokerSearchQuery, setBrokerSearchQuery] = useState('');
  const [brokerCategoryFilter, setBrokerCategoryFilter] = useState<'ALL' | 'POPULAR' | 'Dijital / FinTech' | 'Banka İştiraki' | 'Bağımsız Kurum'>('ALL');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [shares, setShares] = useState<number>(10);
  const [priceInput, setPriceInput] = useState<string>('');

  const handleOpenBroker = (broker: Broker) => {
    showToast({
      type: 'info',
      title: `${broker.shortName}'a Yönlendiriliyorsunuz`,
      message: `${symbol} alım-satım işlemi için ${broker.name} açılıyor...`,
    });
    window.open(broker.url, '_blank', 'noopener,noreferrer');
    setIsTradeModalOpen(false);
  };

  const { stock, loading: stockLoading } = useStockDetail(symbol);
  const { candles, loading: chartLoading } = useStockHistory(symbol, timeframe);
  const { indicators } = useStockIndicators(symbol, timeframe);

  const currSymbol = stock?.currency === 'TRY' ? '₺' : stock?.currency === 'EUR' ? '€' : '$';
  const currentPrice = stock?.price || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const isPositive = (stock?.changePercent || 0) >= 0;
  const isWatchlisted = checkWatchlisted(symbol);

  const handleWatchlistToggle = () => {
    const added = toggleWatchlist({
      symbol,
      name: stock?.name || symbol,
      assetType: 'stock',
      price: currentPrice,
      changePercent: stock?.changePercent || 0,
      exchange: stock?.exchange || 'BIST',
    });

    showToast({
      type: 'success',
      title: added ? 'Takip Listesine Eklendi ⭐' : 'Takip Listesinden Çıkarıldı',
      message: `${symbol} favori listenize ${added ? 'eklendi' : 'çıkarıldı'}.`,
    });
  };

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tradePrice = Number(priceInput) || currentPrice;
    const total = tradePrice * shares;

    await addTransaction({
      portfolioId: activePortfolioId,
      symbol: symbol,
      assetType: 'stock',
      transactionType: tradeType.toLowerCase() as 'buy' | 'sell',
      quantity: shares,
      price: tradePrice,
      commission: 0,
      currency: stock?.currency === 'USD' ? 'USD' : stock?.currency === 'EUR' ? 'EUR' : 'TRY',
      transactionDate: new Date().toISOString().split('T')[0],
      exchange: (stock?.exchange as any) || 'BIST',
      notes: `${symbol} hisse detayından hızlı işlem`,
    });

    showToast({
      type: 'success',
      title: `${tradeType === 'BUY' ? 'Alım' : 'Satım'} Emri Kaydedildi!`,
      message: `${shares} adet ${symbol} ${currSymbol}${tradePrice.toFixed(2)} fiyattan portföyünüze eklendi. Toplam: ${currSymbol}${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
    });
    setIsTradeModalOpen(false);
    fetchLivePrices();
  };

  const marketStatus = (() => {
    if (stock?.exchange === 'CRYPTO') return { isOpen: true, label: 'Piyasa açık' };
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return { isOpen: false, label: 'Piyasa kapalı' };
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const trMinutes = (utcHours + 3) * 60 + utcMinutes;
    if (stock?.exchange === 'NASDAQ' || stock?.exchange === 'NYSE') {
      const isOpen = trMinutes >= 990 && trMinutes <= 1380;
      return { isOpen, label: isOpen ? 'Piyasa açık' : 'Piyasa kapalı' };
    }
    const isOpen = trMinutes >= 600 && trMinutes <= 1090;
    return { isOpen, label: isOpen ? 'Piyasa açık' : 'Piyasa kapalı' };
  })();

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${symbol} - StockMind`,
          text: `${symbol} anlık fiyatı: ${currSymbol}${currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(2)}`,
          url: window.location.href,
        });
        return;
      } catch {}
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast({ type: 'success', title: 'Bağlantı Kopyalandı', message: 'Sayfa linki panoya kopyalandı.' });
    }
  };

  const handleSetAlert = () => {
    showToast({
      type: 'info',
      title: 'Fiyat Alarmı',
      message: `${symbol} için fiyat alarmı takip listenize kaydedildi.`,
    });
  };

  const badgeVariant =
    stock?.exchange === 'BIST' ? 'purple' :
    stock?.exchange === 'CRYPTO' ? 'warning' :
    stock?.exchange === 'COMMODITY' ? 'orange' :
    stock?.exchange === 'FOREX' ? 'emerald' : 'info';

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-24 sm:pb-12">
      {/* Midas-Style Top Navigation Bar (Back, Instrument Name, Bookmark, Alert, Share) */}
      <div className="flex items-center justify-between py-1 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer shrink-0"
            title="Geri"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-base sm:text-lg text-text-primary truncate">
              {stock?.name || symbol}
            </span>
            {stock?.name && stock.name !== symbol && (
              <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-bg-secondary text-text-muted shrink-0 hidden sm:inline-block">
                {symbol}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Bookmark / Watchlist */}
          <button
            onClick={handleWatchlistToggle}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isWatchlisted
                ? 'text-warning bg-warning/15'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-secondary'
            }`}
            title={isWatchlisted ? 'Takip Listesinden Çıkar' : 'Takip Listesine Ekle'}
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          {/* Price Alert */}
          <button
            onClick={handleSetAlert}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
            title="Fiyat Alarmı Kur"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
            title="Paylaş"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Midas-Style Symbol & Price Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          {/* Symbol & Market Status Badge */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-text-primary font-mono">
              {symbol}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${
                marketStatus.isOpen
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-bg-tertiary text-text-muted border-border'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  marketStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'
                }`}
              />
              {marketStatus.label}
            </span>
          </div>

          {/* Instrument Full Name */}
          <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium line-clamp-1">
            {stock?.name || symbol}
          </p>

          {/* Prominent Price & Clean Percentage */}
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-text-primary">
              {currSymbol}
              {currentPrice < 1
                ? currentPrice.toFixed(4)
                : currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-mono ${
                isPositive ? 'text-success' : 'text-danger'
              }`}
            >
              %{Math.abs(stock?.changePercent || 0).toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* Desktop Quick Actions */}
        <div className="hidden sm:flex items-center gap-2 pb-1">
          <Link
            href={`/ai-assistant?prompt=${encodeURIComponent(
              `${symbol} için teknik ve temel analiz yap, destek-direnç ve risk durumunu özetle.`
            )}`}
          >
            <Button
              variant="secondary"
              size="md"
              leftIcon={
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            >
              AI Analiz
            </Button>
          </Link>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setPriceInput(currentPrice.toString());
              setIsTradeModalOpen(true);
            }}
          >
            İşlem Yap
          </Button>
        </div>
      </div>

      {/* Chart Section - Single Unified Box */}
      <div className="space-y-3">
        {chartLoading && candles.length === 0 ? (
          <div className="glass-card h-[320px] sm:h-[450px] flex items-center justify-center text-text-muted">
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs sm:text-sm font-medium">Piyasa mum verileri yükleniyor...</span>
            </div>
          </div>
        ) : (
          <CandlestickChart
            candles={candles}
            symbol={symbol}
            height={440}
            showSMA20={showSMA20}
            showSMA50={showSMA50}
            showBB={showBB}
            showVolume={showVolume}
            sma20={indicators?.indicators?.sma20 || []}
            sma50={indicators?.indicators?.sma50 || []}
            bollingerBands={indicators?.indicators?.bollingerBands || []}
            bottomControls={
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                {/* Timeframe Selector with Midas-style capsule pills */}
                <div className="flex items-center gap-1 bg-bg-secondary/70 p-1 rounded-full border border-border/80 overflow-x-auto no-scrollbar scroll-smooth">
                  {[
                    { id: '1D', label: '1G' },
                    { id: '1W', label: '1H' },
                    { id: '1M', label: '1A' },
                    { id: '3M', label: '3A' },
                    { id: '6M', label: '6A' },
                    { id: '1Y', label: '1Y' },
                    { id: '5Y', label: '5Y' },
                    { id: 'ALL', label: 'Tümü' },
                  ].map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => setTimeframe(tf.id as any)}
                      className={`flex-1 min-w-[36px] py-1 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
                        timeframe === tf.id
                          ? 'bg-accent text-white shadow-sm shadow-accent/20 font-bold'
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {/* Indicator toggles */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                  <button
                    onClick={() => setShowSMA20(!showSMA20)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
                      showSMA20
                        ? 'bg-warning/20 border-warning text-warning'
                        : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${showSMA20 ? 'bg-warning' : 'bg-text-muted'}`} />
                    SMA 20
                  </button>
                  <button
                    onClick={() => setShowSMA50(!showSMA50)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
                      showSMA50
                        ? 'bg-info/20 border-info text-info'
                        : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${showSMA50 ? 'bg-info' : 'bg-text-muted'}`} />
                    SMA 50
                  </button>
                  <button
                    onClick={() => setShowBB(!showBB)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
                      showBB
                        ? 'bg-accent-secondary/20 border-accent-secondary text-accent-secondary'
                        : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${showBB ? 'bg-accent-secondary' : 'bg-text-muted'}`} />
                    Bollinger
                  </button>
                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
                      showVolume
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${showVolume ? 'bg-accent' : 'bg-text-muted'}`} />
                    Hacim
                  </button>
                </div>
              </div>
            }
          />
        )}
      </div>

      {/* Midas-Style AI / Market Intelligence Snapshot Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-bg-card/80 border border-border/80 flex flex-col gap-1.5 hover:border-accent/40 transition-colors shadow-xs">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span>StockMind AI Bülteni • 3 saat önce</span>
        </div>
        <p className="text-xs sm:text-sm text-text-primary leading-relaxed font-medium">
          {symbol}'da son dönem fiyat hareketi, teknik destek-direnç seviyeleri ve güncel piyasa momentumu analiz edildi.
        </p>
        <Link
          href={`/ai-assistant?prompt=${encodeURIComponent(
            `${symbol} için teknik ve temel analiz yap, destek-direnç ve risk durumunu özetle.`
          )}`}
          className="text-xs font-bold text-accent hover:text-accent-hover inline-flex items-center gap-1 mt-0.5 group w-fit"
        >
          <span>Analizi gör</span>
          <span className="group-hover:translate-x-0.5 transition-transform">&rsaquo;</span>
        </Link>
      </div>

      {/* Technical Indicators Panel */}
      <TechnicalIndicatorsPanel indicators={indicators} currentPrice={currentPrice} />

      {/* Key Stats Grid - Mobile Optimized 2-Column Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] text-text-muted block">Günlük Aralık</span>
          <span className="text-xs sm:text-sm font-semibold font-mono text-text-primary mt-1 block truncate">
            {currSymbol}{stock?.low?.toFixed(2)} - {currSymbol}{stock?.high?.toFixed(2)}
          </span>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] text-text-muted block">52H Aralık</span>
          <span className="text-xs sm:text-sm font-semibold font-mono text-text-primary mt-1 block truncate">
            {currSymbol}{stock?.low52w?.toFixed(2)} - {currSymbol}{stock?.high52w?.toFixed(2)}
          </span>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] text-text-muted block">Hacim</span>
          <span className="text-xs sm:text-sm font-semibold font-mono text-text-primary mt-1 block truncate">
            {stock?.volume ? (stock.volume > 1e6 ? `${(stock.volume / 1e6).toFixed(1)}M` : `${(stock.volume / 1e3).toFixed(0)}K`) : '-'}
          </span>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] text-text-muted block">Piyasa Değeri</span>
          <span className="text-xs sm:text-sm font-semibold font-mono text-text-primary mt-1 block truncate">
            {stock?.marketCap ? `${currSymbol}${((stock.marketCap) / 1e9).toFixed(1)} Mr` : '-'}
          </span>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] text-text-muted block">F/K Oranı (P/E)</span>
          <span className="text-xs sm:text-sm font-semibold font-mono text-text-primary mt-1 block truncate">
            {stock?.peRatio ? stock.peRatio.toFixed(1) : '-'}
          </span>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] text-text-muted block">Temettü Verimi</span>
          <span className="text-xs sm:text-sm font-semibold font-mono text-text-primary mt-1 block truncate">
            %{stock?.dividendYield ? stock.dividendYield.toFixed(2) : '0.00'}
          </span>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-card/95 backdrop-blur-md border-t border-border p-2.5 px-4 flex items-center justify-between gap-3 shadow-2xl">
        <div className="min-w-0">
          <span className="font-mono text-sm font-bold text-text-primary block truncate">
            {currSymbol}{currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(2)}
          </span>
          <span className={`text-[10px] font-mono font-bold block ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? '+' : ''}{stock?.changePercent ? stock.changePercent.toFixed(2) : '0.00'}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleWatchlistToggle}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isWatchlisted
                ? 'bg-warning/20 border-warning text-warning'
                : 'bg-bg-tertiary border-border text-text-muted'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>

          <Link
            href={`/ai-assistant?prompt=${encodeURIComponent(
              `${symbol} için teknik ve temel analiz yap, destek-direnç ve risk durumunu özetle.`
            )}`}
          >
            <Button variant="secondary" size="sm">
              ⚡ AI
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setPriceInput(currentPrice.toString());
              setIsTradeModalOpen(true);
            }}
          >
            İşlem Yap
          </Button>
        </div>
      </div>

      {/* Quick Trade & Brokerage Modal */}
      <Modal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        title={`${symbol} — İşlem Yap`}
        description="Güvenli alım-satım için aracı kurumunuzu seçin veya sanal portföye ekleyin."
      >
        <div className="space-y-4">
          {/* Symbol Quick Info */}
          <div className="p-3 bg-bg-secondary rounded-xl border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center font-black font-mono text-accent text-sm">
                {symbol.slice(0, 3)}
              </div>
              <div>
                <div className="font-mono font-bold text-sm text-text-primary">{symbol}</div>
                <div className="text-[11px] text-text-secondary truncate max-w-[160px] sm:max-w-[220px]">
                  {stock?.name || symbol}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-sm text-text-primary">
                {currSymbol}{currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </div>
              <div className={`text-[11px] font-mono font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                {isPositive ? '+' : ''}{stock?.changePercent ? stock.changePercent.toFixed(2) : '0.00'}%
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-bg-secondary rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setTradeModalTab('broker')}
              className={`py-2 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tradeModalTab === 'broker'
                  ? 'bg-accent text-white shadow-md shadow-accent/20'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>🏛️</span>
              <span>Aracı Kurumlar</span>
            </button>
            <button
              type="button"
              onClick={() => setTradeModalTab('virtual')}
              className={`py-2 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tradeModalTab === 'virtual'
                  ? 'bg-bg-tertiary text-text-primary border border-border shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>📝</span>
              <span>Sanal Portföy</span>
            </button>
          </div>

          {/* Brokerage Tab Content */}
          {tradeModalTab === 'broker' ? (
            <div className="space-y-3 pt-1">
              {/* Search & Filter Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Aracı kurum ara (örn: Midas, İş, Garanti, Piapiri)..."
                  value={brokerSearchQuery}
                  onChange={(e) => setBrokerSearchQuery(e.target.value)}
                  className="w-full py-2 pl-9 pr-8 bg-bg-secondary text-text-primary rounded-xl border border-border text-xs focus:outline-hidden focus:border-accent transition-colors placeholder:text-text-muted"
                />
                <svg className="w-4 h-4 text-text-muted absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {brokerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBrokerSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setBrokerCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                    brokerCategoryFilter === 'ALL'
                      ? 'bg-accent text-white font-bold'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
                  }`}
                >
                  Tümü ({BROKERS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBrokerCategoryFilter('POPULAR')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                    brokerCategoryFilter === 'POPULAR'
                      ? 'bg-accent text-white font-bold'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
                  }`}
                >
                  ⭐ Popüler ({BROKERS.filter((b) => b.popular).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBrokerCategoryFilter('Dijital / FinTech')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                    brokerCategoryFilter === 'Dijital / FinTech'
                      ? 'bg-accent text-white font-bold'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
                  }`}
                >
                  📱 FinTech ({BROKERS.filter((b) => b.category === 'Dijital / FinTech').length})
                </button>
                <button
                  type="button"
                  onClick={() => setBrokerCategoryFilter('Banka İştiraki')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                    brokerCategoryFilter === 'Banka İştiraki'
                      ? 'bg-accent text-white font-bold'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
                  }`}
                >
                  🏦 Bankalar ({BROKERS.filter((b) => b.category === 'Banka İştiraki').length})
                </button>
                <button
                  type="button"
                  onClick={() => setBrokerCategoryFilter('Bağımsız Kurum')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                    brokerCategoryFilter === 'Bağımsız Kurum'
                      ? 'bg-accent text-white font-bold'
                      : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
                  }`}
                >
                  📈 Bağımsız ({BROKERS.filter((b) => b.category === 'Bağımsız Kurum').length})
                </button>
              </div>

              {/* Broker List */}
              <div className="max-h-[340px] sm:max-h-[380px] overflow-y-auto pr-1 space-y-2.5">
                {(() => {
                  const filtered = BROKERS.filter((b) => {
                    if (brokerCategoryFilter === 'POPULAR' && !b.popular) return false;
                    if (
                      brokerCategoryFilter !== 'ALL' &&
                      brokerCategoryFilter !== 'POPULAR' &&
                      b.category !== brokerCategoryFilter
                    )
                      return false;
                    if (brokerSearchQuery.trim()) {
                      const q = brokerSearchQuery.toLowerCase();
                      return (
                        b.name.toLowerCase().includes(q) ||
                        b.shortName.toLowerCase().includes(q) ||
                        b.description.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-text-muted text-xs bg-bg-secondary/40 rounded-xl border border-dashed border-border">
                        Aramanıza uygun aracı kurum bulunamadı.
                      </div>
                    );
                  }

                  return filtered.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleOpenBroker(b)}
                      className="group relative p-3 sm:p-3.5 rounded-2xl border border-border/80 bg-gradient-to-r from-bg-card via-bg-secondary to-bg-card hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all cursor-pointer overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${b.gradient} flex items-center justify-center text-white font-black text-lg shadow-md shrink-0`}
                          >
                            {b.letter}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-text-primary group-hover:text-accent transition-colors">
                                {b.shortName}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                                {b.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                              {b.description}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-tertiary group-hover:bg-accent group-hover:text-white text-text-muted transition-all">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-bg-tertiary/60 rounded-xl border border-border/50 text-[11px] text-text-muted leading-relaxed flex items-start gap-2">
                <span className="text-sm shrink-0">🛡️</span>
                <span>
                  <strong>Yasal Bilgilendirme:</strong> StockMind doğrudan emir iletimi veya aracılık yapmaz. Tüm işlemler seçtiğiniz SPK lisanslı yetkili aracı kurumun kendi resmi arayüzü üzerinden gerçekleştirilir.
                </span>
              </div>
            </div>
          ) : (
            /* Virtual Portfolio Tab Content */
            <form onSubmit={handleTradeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-bg-secondary rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setTradeType('BUY')}
                  className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    tradeType === 'BUY'
                      ? 'bg-success text-white shadow-md shadow-success/20'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  AL (BUY)
                </button>
                <button
                  type="button"
                  onClick={() => setTradeType('SELL')}
                  className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    tradeType === 'SELL'
                      ? 'bg-danger text-white shadow-md shadow-danger/20'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  SAT (SELL)
                </button>
              </div>

              <Input
                label="Birim Fiyat"
                type="number"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                required
                helperText={`Anlık Fiyat: ${currSymbol}${currentPrice.toFixed(2)}`}
              />

              <Input
                label="Adet / Lot"
                type="number"
                min="1"
                value={shares}
                onChange={(e) => setShares(Number(e.target.value))}
                required
              />

              <div className="bg-bg-tertiary p-3 rounded-xl border border-border flex justify-between items-center text-sm">
                <span className="text-text-secondary">Tahmini Toplam:</span>
                <span className="font-bold font-mono text-text-primary">
                  {currSymbol}
                  {((Number(priceInput) || currentPrice) * shares).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsTradeModalOpen(false)}
                >
                  Kapat
                </Button>
                <Button
                  type="submit"
                  variant={tradeType === 'BUY' ? 'success' : 'danger'}
                >
                  {tradeType === 'BUY' ? 'Sanal Portföye Alış Ekle' : 'Sanal Portföye Satış Ekle'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
