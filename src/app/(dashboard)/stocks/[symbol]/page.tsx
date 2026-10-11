'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStockDetail, useStockHistory, useStockIndicators } from '@/hooks/useStockData';
import { CandlestickChart } from '@/components/stocks/CandlestickChart';
import { TechnicalIndicatorsPanel } from '@/components/stocks/TechnicalIndicatorsPanel';
import { Badge, Button, Modal, Input, useToast, InstrumentLogo } from '@/components/ui';
import { useWatchlistStore } from '@/store/useWatchlistStore';

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

  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL'>('1Y');
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  // Buy/Sell Quick Modal & Broker Redirection
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeModalTab, setTradeModalTab] = useState<'broker' | 'virtual'>('broker');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [shares, setShares] = useState<number>(10);
  const [priceInput, setPriceInput] = useState<string>('');

  const handleOpenBroker = (brokerName: 'Midas' | 'Piapiri') => {
    const urls = {
      Midas: 'https://www.getmidas.com',
      Piapiri: 'https://www.piapiri.com',
    };
    showToast({
      type: 'info',
      title: `${brokerName}'a Yönlendiriliyorsunuz`,
      message: `${symbol} işlemi için ${brokerName} açılıyor...`,
    });
    window.open(urls[brokerName], '_blank', 'noopener,noreferrer');
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

  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tradePrice = Number(priceInput) || currentPrice;
    const total = tradePrice * shares;

    showToast({
      type: 'success',
      title: `${tradeType === 'BUY' ? 'Alım' : 'Satım'} Emri Başarılı!`,
      message: `${shares} adet ${symbol} ${currSymbol}${tradePrice.toFixed(2)} fiyattan portföyünüze eklendi. Toplam: ${currSymbol}${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
    });
    setIsTradeModalOpen(false);
  };

  const badgeVariant =
    stock?.exchange === 'BIST' ? 'purple' :
    stock?.exchange === 'CRYPTO' ? 'warning' :
    stock?.exchange === 'COMMODITY' ? 'orange' :
    stock?.exchange === 'FOREX' ? 'emerald' : 'info';

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-20 sm:pb-12">
      {/* Mobile Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
        <Link
          href="/piyasalar"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          <span>&larr;</span>
          <span>Piyasalar</span>
        </Link>
        <div className="flex items-center gap-1.5 font-medium">
          <span className="text-text-muted">Enstrüman:</span>
          <span className="text-text-primary font-bold">{symbol}</span>
        </div>
      </div>

      {/* Stock Main Header - Mobile Optimized Card */}
      <div className="glass-card p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <InstrumentLogo symbol={symbol} name={stock?.name} size="lg" rounded="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary truncate">
                {symbol}
              </h1>
              <Badge variant={badgeVariant as any} size="sm">
                {stock?.exchange || 'BIST'}
              </Badge>
              {stock?.sector && (
                <span className="text-[11px] text-text-muted hidden xs:inline truncate">
                  • {stock.sector}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5 truncate">
              {stock?.name || symbol}
            </p>
          </div>
        </div>

        {/* Live Price Display & Desktop Actions */}
        <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-6 pt-2 lg:pt-0 border-t border-border/40 lg:border-t-0">
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-text-primary">
              {currSymbol}
              {currentPrice < 1
                ? currentPrice.toFixed(4)
                : currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg ${
                  isPositive ? 'text-success bg-success/15' : 'text-danger bg-danger/15'
                }`}
              >
                {isPositive ? '+' : ''}
                {stock?.change ? stock.change.toFixed(2) : '0.00'} ({isPositive ? '+' : ''}
                {stock?.changePercent ? stock.changePercent.toFixed(2) : '0.00'}%)
              </span>
              <span className="text-[10px] text-text-muted flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Canlı
              </span>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handleWatchlistToggle}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                isWatchlisted
                  ? 'bg-warning/20 border-warning text-warning'
                  : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
              }`}
              title={isWatchlisted ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>

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
      </div>

      {/* Chart Section */}
      <div className="space-y-3">
        {/* Controls Bar: Timeframe & Indicators in a smooth horizontal touch-scroller */}
        <div className="glass-card p-2 sm:p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
          {/* Timeframe Selector with smooth touch scroll */}
          <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-xl border border-border overflow-x-auto no-scrollbar scroll-smooth">
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
                className={`flex-1 min-w-[38px] py-1.5 px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
                  timeframe === tf.id
                    ? 'bg-accent text-white shadow-md shadow-accent/25'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Indicator toggles */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs pb-0.5">
            <button
              onClick={() => setShowSMA20(!showSMA20)}
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
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
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
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
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
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
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 text-[11px] ${
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

        {/* Unified Native Candlestick Chart */}
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
          />
        )}
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
              <p className="text-xs text-text-secondary leading-relaxed">
                İşlem yapmak istediğiniz SPK lisanslı aracı kurumu seçin:
              </p>

              {/* Midas Card */}
              <div
                onClick={() => handleOpenBroker('Midas')}
                className="group relative p-4 rounded-2xl border border-border/80 bg-gradient-to-r from-bg-card via-bg-secondary to-bg-card hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-500/20 shrink-0">
                      M
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-primary group-hover:text-indigo-400 transition-colors">
                          Midas
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                          BIST & ABD Borsaları
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1 leading-snug">
                        Düşük komisyon, anlık canlı veri ve hızlı emir iletimi ile işlem yapın.
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-tertiary group-hover:bg-indigo-500 group-hover:text-white text-text-muted transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Piapiri Card */}
              <div
                onClick={() => handleOpenBroker('Piapiri')}
                className="group relative p-4 rounded-2xl border border-border/80 bg-gradient-to-r from-bg-card via-bg-secondary to-bg-card hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all pointer-events-none" />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-orange-500/20 shrink-0">
                      P
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-primary group-hover:text-orange-400 transition-colors">
                          Piapiri
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">
                          Ünlü & Co
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1 leading-snug">
                        Model portföyler, uzman analist önerileri ve robotik alım-satım sinyalleri.
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-tertiary group-hover:bg-orange-500 group-hover:text-white text-text-muted transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                </div>
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
