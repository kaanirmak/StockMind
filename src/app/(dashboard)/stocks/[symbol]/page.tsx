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

  // Buy/Sell Quick Modal
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [shares, setShares] = useState<number>(10);
  const [priceInput, setPriceInput] = useState<string>('');

  const { stock, loading: stockLoading } = useStockDetail(symbol);
  const { candles, loading: chartLoading } = useStockHistory(symbol, timeframe);
  const { indicators } = useStockIndicators(symbol, timeframe);

  const currSymbol = stock?.currency === 'TRY' ? '₺' : '$';
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/stocks" className="hover:text-text-primary transition-colors">
          Hisseler
        </Link>
        <span>/</span>
        <span className="text-text-primary font-semibold">{symbol}</span>
      </div>

      {/* Stock Main Header */}
      <div className="glass-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <InstrumentLogo symbol={symbol} name={stock?.name} size="xl" rounded="2xl" />
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-text-primary">{symbol}</h1>
              <Badge variant={stock?.exchange === 'BIST' ? 'purple' : 'info'} size="sm">
                {stock?.exchange || 'BIST'}
              </Badge>
              <span className="text-xs text-text-muted">{stock?.sector}</span>
            </div>
            <p className="text-sm text-text-secondary mt-1">{stock?.name || symbol}</p>
          </div>
        </div>

        {/* Live Price Display & Actions */}
        <div className="flex flex-wrap items-center gap-6 justify-between lg:justify-end">
          <div className="text-left lg:text-right">
            <div className="text-3xl font-black font-mono text-text-primary">
              {currSymbol}
              {currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg ${
                  isPositive ? 'text-success bg-success/15' : 'text-danger bg-danger/15'
                }`}
              >
                {isPositive ? '+' : ''}
                {stock?.change?.toFixed(2)} ({isPositive ? '+' : ''}
                {stock?.changePercent?.toFixed(2)}%)
              </span>
              <span className="text-[11px] text-text-muted">Canlı</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            <Link href={`/ai-assistant?prompt=${encodeURIComponent(`${symbol} hissesi için teknik ve temel analiz yap, hedef fiyat ve risk seviyesini belirt.`)}`}>
              <Button variant="secondary" size="md" leftIcon={
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }>
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
        {/* Controls Bar: Timeframe & Indicators in a mobile-friendly horizontal scroller */}
        <div className="glass-card p-2.5 sm:p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Timeframe Selector with smooth mobile scroll */}
          <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-xl border border-border overflow-x-auto no-scrollbar">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <button
              onClick={() => setShowSMA20(!showSMA20)}
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 ${
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
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 ${
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
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 ${
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
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap flex items-center gap-1.5 ${
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
          <div className="glass-card h-[360px] sm:h-[460px] flex items-center justify-center text-text-muted">
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Piyasa mum verileri yükleniyor...</span>
            </div>
          </div>
        ) : (
          <CandlestickChart
            candles={candles}
            symbol={symbol}
            height={460}
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

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card p-4">
          <span className="text-xs text-text-muted block">Günlük Aralık</span>
          <span className="text-sm font-semibold font-mono text-text-primary mt-1 block">
            {currSymbol}{stock?.low?.toFixed(2)} - {currSymbol}{stock?.high?.toFixed(2)}
          </span>
        </div>
        <div className="glass-card p-4">
          <span className="text-xs text-text-muted block">52H Aralık</span>
          <span className="text-sm font-semibold font-mono text-text-primary mt-1 block">
            {currSymbol}{stock?.low52w?.toFixed(2)} - {currSymbol}{stock?.high52w?.toFixed(2)}
          </span>
        </div>
        <div className="glass-card p-4">
          <span className="text-xs text-text-muted block">Hacim</span>
          <span className="text-sm font-semibold font-mono text-text-primary mt-1 block">
            {stock?.volume ? `${(stock.volume / 1e6).toFixed(2)}M` : '-'}
          </span>
        </div>
        <div className="glass-card p-4">
          <span className="text-xs text-text-muted block">Piyasa Değeri</span>
          <span className="text-sm font-semibold font-mono text-text-primary mt-1 block">
            {currSymbol}{((stock?.marketCap || 0) / 1e9).toFixed(1)} Mr
          </span>
        </div>
        <div className="glass-card p-4">
          <span className="text-xs text-text-muted block">F/K Oranı (P/E)</span>
          <span className="text-sm font-semibold font-mono text-text-primary mt-1 block">
            {stock?.peRatio ? stock.peRatio.toFixed(1) : '-'}
          </span>
        </div>
        <div className="glass-card p-4">
          <span className="text-xs text-text-muted block">Temettü Verimi</span>
          <span className="text-sm font-semibold font-mono text-text-primary mt-1 block">
            %{stock?.dividendYield ? stock.dividendYield.toFixed(2) : '0.00'}
          </span>
        </div>
      </div>

      {/* Quick Trade Modal */}
      <Modal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        title={`${symbol} — Hızlı İşlem`}
        description="Portföyünüze alım veya satım işlemi ekleyin."
      >
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
            <span className="text-text-secondary">Tahmini Toplam Tutar:</span>
            <span className="font-bold font-mono text-text-primary">
              {currSymbol}
              {((Number(priceInput) || currentPrice) * shares).toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsTradeModalOpen(false)}
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant={tradeType === 'BUY' ? 'success' : 'danger'}
            >
              {tradeType === 'BUY' ? 'Alış Emrini Onayla' : 'Satış Emrini Onayla'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
