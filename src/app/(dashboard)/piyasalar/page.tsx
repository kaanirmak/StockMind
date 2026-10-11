'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStocks, StockWithQuote } from '@/hooks/useStockData';
import { useFunds } from '@/hooks/useFunds';
import { Badge, Button, Input, TableSkeleton, useToast, InstrumentLogo } from '@/components/ui';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { formatNumber, getPnLColor, getPnLSign } from '@/lib/utils/format';

type MarketId = 'ALL' | 'BIST' | 'COMMODITY' | 'CRYPTO' | 'FOREX' | 'INDEX' | 'TEFAS' | 'NASDAQ' | 'NYSE';

const MARKETS: Array<{ id: MarketId; label: string; icon: string; name: string }> = [
  { id: 'ALL', label: 'Tüm Piyasalar', icon: '🌟', name: 'Canlı Finans Özeti' },
  { id: 'BIST', label: 'BIST', icon: '🇹🇷', name: 'Borsa İstanbul' },
  { id: 'COMMODITY', label: 'Emtia & Altın', icon: '🪙', name: 'Kıymetli Madenler' },
  { id: 'CRYPTO', label: 'Kripto', icon: '₿', name: 'Kripto Paralar' },
  { id: 'FOREX', label: 'Döviz', icon: '💱', name: 'Döviz Kurları' },
  { id: 'INDEX', label: 'Endeksler', icon: '🌍', name: 'Küresel Endeksler' },
  { id: 'TEFAS', label: 'TEFAS', icon: '📊', name: 'Yatırım Fonları' },
  { id: 'NASDAQ', label: 'NASDAQ', icon: '🇺🇸', name: 'NASDAQ' },
  { id: 'NYSE', label: 'NYSE', icon: '🏛️', name: 'NYSE' },
];

interface OverviewSections {
  commodity: StockWithQuote[];
  forex: StockWithQuote[];
  crypto: StockWithQuote[];
  indices: StockWithQuote[];
}

function PiyasalarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawParam = (searchParams.get('market') || searchParams.get('tab') || searchParams.get('exchange') || 'ALL').toUpperCase();
  const initialMarket: MarketId = 
    rawParam === 'ALL' || rawParam === 'OZET' || rawParam === 'TUMU' ? 'ALL' :
    rawParam === 'FUNDS' || rawParam === 'TEFAS' ? 'TEFAS' :
    rawParam === 'COMMODITY' || rawParam === 'EMTIA' || rawParam === 'ALTIN' ? 'COMMODITY' :
    rawParam === 'CRYPTO' || rawParam === 'KRIPTO' ? 'CRYPTO' :
    rawParam === 'FOREX' || rawParam === 'DOVIZ' || rawParam === 'FX' ? 'FOREX' :
    rawParam === 'INDEX' || rawParam === 'ENDEKS' ? 'INDEX' :
    rawParam === 'NASDAQ' ? 'NASDAQ' :
    rawParam === 'NYSE' ? 'NYSE' : 'BIST';

  const [activeMarket, setActiveMarket] = useState<MarketId>(initialMarket);

  // Overview Data (for 'ALL' market tab)
  const [overviewData, setOverviewData] = useState<{
    tickers: Array<{ symbol: string; name: string; value: number; change: number; currency: 'TRY' | 'USD'; flag: string }>;
    sections: OverviewSections | null;
  }>({ tickers: [], sections: null });
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Stocks state
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [stockSearch, setStockSearch] = useState<string>('');
  const [stockSortBy, setStockSortBy] = useState<'changePercent' | 'price' | 'volume' | 'marketCap'>('changePercent');
  const [stockSortOrder, setStockSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Infinite scroll / lazy loading for stocks (loads in chunks of 30)
  const [stockLimit, setStockLimit] = useState<number>(30);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Funds state
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [fundSearch, setFundSearch] = useState<string>('');
  const [fundLimit, setFundLimit] = useState<number>(30);
  const loadMoreFundsRef = useRef<HTMLDivElement>(null);
  const [fundSortBy, setFundSortBy] = useState<'dailyReturn' | 'monthlyReturn' | 'return3m' | 'yearlyReturn' | 'return3y' | 'return5y' | 'price' | 'riskValue'>('yearlyReturn');
  const [fundSortOrder, setFundSortOrder] = useState<'asc' | 'desc'>('desc');

  // Shared view mode
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const { showToast } = useToast();
  const { toggleWatchlist, isWatchlisted: checkWatchlisted } = useWatchlistStore();

  const handleMarketChange = (market: MarketId) => {
    setActiveMarket(market);
    setStockLimit(30);
    setFundLimit(30);
    router.replace(`/piyasalar?market=${market.toLowerCase()}`, { scroll: false });
  };

  // Reset lazy load limit when filter changes
  useEffect(() => {
    setStockLimit(30);
  }, [activeMarket, selectedSector, stockSearch, stockSortBy, stockSortOrder]);

  useEffect(() => {
    setFundLimit(30);
  }, [activeMarket, selectedCategory, fundSearch, fundSortBy, fundSortOrder]);

  // Fetch overview data when activeMarket is 'ALL'
  useEffect(() => {
    if (activeMarket !== 'ALL') return;
    let isMounted = true;
    async function fetchOverview() {
      try {
        setOverviewLoading(true);
        const res = await fetch('/api/markets/overview');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success) {
            setOverviewData({
              tickers: json.data || [],
              sections: json.sections || null,
            });
          }
        }
      } catch (e) {
        console.error('Error fetching overview data:', e);
      } finally {
        if (isMounted) setOverviewLoading(false);
      }
    }
    fetchOverview();
  }, [activeMarket]);

  // Stocks data (active when activeMarket is BIST, COMMODITY, CRYPTO, FOREX, INDEX, NASDAQ, or NYSE)
  const isStocksMarket = activeMarket !== 'TEFAS' && activeMarket !== 'ALL';
  const { stocks, loading: stocksLoading, error: stocksError } = useStocks(
    isStocksMarket
      ? {
          exchange: activeMarket,
          sector: selectedSector,
          search: stockSearch,
        }
      : undefined
  );

  // If in 'ALL' tab, also fetch BIST top stocks
  const { stocks: bistStocks } = useStocks(activeMarket === 'ALL' ? { exchange: 'BIST' } : undefined);

  const sortedStocks = [...stocks].sort((a, b) => {
    const valA = a[stockSortBy] || 0;
    const valB = b[stockSortBy] || 0;
    return stockSortOrder === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
  });

  const visibleStocks = sortedStocks.slice(0, stockLimit);

  // IntersectionObserver for smooth infinite scroll on stocks
  useEffect(() => {
    if (!loadMoreRef.current || !isStocksMarket) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && stockLimit < sortedStocks.length) {
          setStockLimit((prev) => Math.min(prev + 30, sortedStocks.length));
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [stockLimit, sortedStocks.length, isStocksMarket]);

  const toggleStockSort = (column: 'changePercent' | 'price' | 'volume' | 'marketCap') => {
    if (stockSortBy === column) setStockSortOrder(stockSortOrder === 'desc' ? 'asc' : 'desc');
    else { setStockSortBy(column); setStockSortOrder('desc'); }
  };

  // Funds data
  const { funds, loading: fundsLoading, error: fundsError } = useFunds({
    category: selectedCategory,
    search: fundSearch,
  });

  const sortedFunds = [...funds].sort((a, b) => {
    const valA = a[fundSortBy] || 0;
    const valB = b[fundSortBy] || 0;
    return stockSortOrder === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
  });
  const visibleFunds = sortedFunds.slice(0, fundLimit);

  // IntersectionObserver for smooth infinite scroll on TEFAS funds
  useEffect(() => {
    if (!loadMoreFundsRef.current || activeMarket !== 'TEFAS') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && fundLimit < sortedFunds.length) {
          setFundLimit((prev) => Math.min(prev + 30, sortedFunds.length));
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(loadMoreFundsRef.current);
    return () => observer.disconnect();
  }, [fundLimit, sortedFunds.length, activeMarket]);

  const toggleFundSort = (column: typeof fundSortBy) => {
    if (fundSortBy === column) setFundSortOrder(fundSortOrder === 'desc' ? 'asc' : 'desc');
    else { setFundSortBy(column); setFundSortOrder('desc'); }
    setFundLimit(30);
  };

  const sectors = ['ALL', 'Bankacılık', 'Havacılık', 'Savunma', 'Sanayi', 'Perakende', 'Teknoloji', 'Enerji', 'Holding'];

  const fundCategories = [
    { id: 'ALL', label: 'Tüm Fonlar' },
    { id: 'Hisse Senedi Fonu', label: '📈 Hisse' },
    { id: 'Değişken Fon', label: '⚖️ Değişken' },
    { id: 'Fon Sepeti Fonu', label: '🌐 Yabancı' },
    { id: 'Kıymetli Madenler Fonu', label: '🥇 Altın' },
    { id: 'Para Piyasası Fonu', label: '💵 Para Piy.' },
    { id: 'Borçlanma Araçları Fonu', label: '🏦 Borçlanma' },
  ];

  const getBadgeVariant = (ex: string) => {
    if (ex === 'BIST') return 'purple';
    if (ex === 'CRYPTO') return 'warning';
    if (ex === 'COMMODITY') return 'orange';
    if (ex === 'FOREX') return 'emerald';
    return 'info';
  };

  const renderMiniAssetCard = (item: StockWithQuote, keyPrefix: string) => {
    const isPositive = (item.changePercent || 0) >= 0;
    const curr = (item.currency as string) === 'TRY' ? '₺' : (item.currency as string) === 'EUR' ? '€' : '$';
    const isStarred = checkWatchlisted(item.symbol);

    return (
      <div
        key={`${keyPrefix}-${item.symbol}`}
        className="glass-card p-3 hover:border-accent/40 transition-all duration-200 flex items-center justify-between gap-3 group relative cursor-pointer"
      >
        <Link href={`/stocks/${item.symbol}`} className="flex items-center gap-2.5 min-w-0 flex-1">
          <InstrumentLogo symbol={item.symbol} name={item.name} size="sm" />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-xs sm:text-sm text-text-primary block truncate group-hover:text-accent transition-colors">
              {item.symbol}
            </span>
            <span className="text-[11px] text-text-muted truncate block">
              {item.name}
            </span>
          </div>
        </Link>

        <div className="text-right shrink-0">
          <span className="font-mono font-bold text-xs sm:text-sm text-text-primary block">
            {curr}{item.price < 1 ? item.price.toFixed(4) : item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </span>
          <span
            className={`font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.2 rounded ${
              isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
            }`}
          >
            {isPositive ? '+' : ''}{item.changePercent?.toFixed(2)}%
          </span>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const added = toggleWatchlist({
              symbol: item.symbol,
              name: item.name,
              assetType: 'stock',
              price: item.price,
              changePercent: item.changePercent,
              exchange: item.exchange,
            });
            showToast({
              type: 'success',
              title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı',
              message: `${item.symbol} ${added ? 'eklendi' : 'çıkarıldı'}.`,
            });
          }}
          className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
            isStarred ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary border-border text-text-muted hover:text-warning'
          }`}
          title="Favorilere Ekle"
        >
          <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text-primary">Piyasalar</h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            BIST, Emtia & Altın, Kripto, Döviz, Küresel Endeksler ve Fonları canlı takip edin.
          </p>
        </div>
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-accent/15 border-accent text-accent' : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'}`}
            title="Tablo Görünümü"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-accent/15 border-accent text-accent' : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'}`}
            title="Kart Görünümü"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══════════════════ TOUCH-FRIENDLY SCROLLABLE TABS BAR ═══════════════════ */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 w-full -mx-1 px-1">
        {MARKETS.map((m) => {
          const isActive = activeMarket === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleMarketChange(m.id)}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border/60'
              }`}
            >
              <span className="text-sm sm:text-base">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════ 1. TAB: 'ALL' (TÜM PİYASALAR ÖZETİ) ═══════════════════ */}
      {activeMarket === 'ALL' && (
        <div className="space-y-6">
          {/* Ticker Cards Bar */}
          {overviewData.tickers.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {overviewData.tickers.map((t) => {
                const isPos = t.change >= 0;
                const prefix = t.currency === 'TRY' ? '₺' : '$';
                return (
                  <div
                    key={t.symbol}
                    onClick={() => {
                      if (t.symbol === 'XU100') handleMarketChange('BIST');
                      else if (t.symbol === 'GA' || t.symbol === 'BRENT') handleMarketChange('COMMODITY');
                      else if (t.symbol === 'USDTRY' || t.symbol === 'EURTRY') handleMarketChange('FOREX');
                      else if (t.symbol === 'BTC') handleMarketChange('CRYPTO');
                      else handleMarketChange('INDEX');
                    }}
                    className="glass-card p-3 hover:border-accent/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base">{t.flag}</span>
                      <span className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                        {t.name}
                      </span>
                    </div>
                    <div className="text-sm sm:text-base font-bold font-mono text-text-primary">
                      {prefix}{t.value < 10 ? t.value.toFixed(2) : formatNumber(t.value)}
                    </div>
                    <div className={`text-xs font-semibold font-mono mt-0.5 ${getPnLColor(t.change)}`}>
                      {getPnLSign(t.change)}{Math.abs(t.change).toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {overviewLoading && !overviewData.sections ? (
            <div className="glass-card p-8"><TableSkeleton rows={6} cols={4} /></div>
          ) : (
            <div className="space-y-6">
              {/* Block 1: Kıymetli Madenler & Emtia */}
              {overviewData.sections?.commodity && overviewData.sections.commodity.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span>🪙 Kıymetli Madenler & Altın</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('COMMODITY')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (12) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.commodity.map((item) => renderMiniAssetCard(item, 'comm'))}
                  </div>
                </div>
              )}

              {/* Block 2: Döviz & Kurlar */}
              {overviewData.sections?.forex && overviewData.sections.forex.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span>💱 Döviz & Para Kurları</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('FOREX')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (9) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.forex.map((item) => renderMiniAssetCard(item, 'fx'))}
                  </div>
                </div>
              )}

              {/* Block 3: Kripto Paralar */}
              {overviewData.sections?.crypto && overviewData.sections.crypto.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span>₿ Popüler Kripto Paralar</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('CRYPTO')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (14) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.crypto.map((item) => renderMiniAssetCard(item, 'crypto'))}
                  </div>
                </div>
              )}

              {/* Block 4: Küresel Borsa Endeksleri */}
              {overviewData.sections?.indices && overviewData.sections.indices.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span>🌍 Küresel Borsa Endeksleri</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('INDEX')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (8) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.indices.map((item) => renderMiniAssetCard(item, 'idx'))}
                  </div>
                </div>
              )}

              {/* Block 5: BIST 100 Trend Hisseleri */}
              {bistStocks && bistStocks.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span>🇹🇷 Borsa İstanbul Trend Hisseleri</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('BIST')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tüm BIST Hisseleri ({bistStocks.length}) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {bistStocks
                      .filter((s) => s.changePercent !== undefined)
                      .slice(0, 6)
                      .map((item) => renderMiniAssetCard(item, 'bist-trend'))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ 2. SPECIFIC STOCKS & MARKETS TABS ═══════════════════ */}
      {isStocksMarket && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass-card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Search */}
              <div className="flex-1">
                <Input
                  placeholder={`${MARKETS.find((m) => m.id === activeMarket)?.name || activeMarket} ara... (örn: ${
                    activeMarket === 'BIST' ? 'THYAO, ASELS' :
                    activeMarket === 'COMMODITY' ? 'Altın, Gümüş, Petrol' :
                    activeMarket === 'CRYPTO' ? 'BTC, ETH, SOL' :
                    activeMarket === 'FOREX' ? 'Dolar, Euro, GBP' :
                    activeMarket === 'INDEX' ? 'S&P 500, DAX, BIST' :
                    activeMarket === 'NASDAQ' ? 'NVDA, AAPL' : 'BRK.B, JPM'
                  })`}
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  leftIcon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                />
              </div>
            </div>
            {/* Sector Chips (Only for equities) */}
            {['BIST', 'NASDAQ', 'NYSE'].includes(activeMarket) && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                <span className="text-text-muted text-[11px] shrink-0 font-medium">Sektör:</span>
                {sectors.map((sector) => (
                  <button
                    key={sector}
                    onClick={() => setSelectedSector(sector)}
                    className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] ${selectedSector === sector ? 'bg-accent/20 border-accent text-accent font-semibold' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'}`}
                  >
                    {sector === 'ALL' ? 'Tüm Sektörler' : sector}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stocks Content */}
          {stocksLoading ? (
            <div className="glass-card p-6"><TableSkeleton rows={8} cols={6} /></div>
          ) : stocksError ? (
            <div className="glass-card p-8 text-center text-danger"><p>{stocksError}</p></div>
          ) : sortedStocks.length === 0 ? (
            <div className="glass-card p-12 text-center text-text-muted space-y-2">
              <svg className="w-12 h-12 mx-auto text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-base font-medium text-text-secondary">Kriterlere uygun varlık bulunamadı.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* Stocks Table with Lazy Load */
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-secondary/80 text-text-muted text-[11px] sm:text-xs uppercase tracking-wider border-b border-border/80">
                    <tr>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold">Sembol</th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold hidden sm:table-cell">Piyasa</th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleStockSort('price')}>
                        Fiyat {stockSortBy === 'price' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleStockSort('changePercent')}>
                        Değişim {stockSortBy === 'changePercent' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden md:table-cell" onClick={() => toggleStockSort('volume')}>
                        Hacim {stockSortBy === 'volume' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {visibleStocks.map((stock) => {
                      const isPositive = (stock.changePercent || 0) >= 0;
                      const curr = (stock.currency as string) === 'TRY' ? '₺' : (stock.currency as string) === 'EUR' ? '€' : '$';
                      const badgeVariant = getBadgeVariant(stock.exchange);

                      return (
                        <tr key={stock.symbol} className="hover:bg-bg-hover/60 transition-colors group cursor-pointer">
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-2 sm:gap-2.5">
                              <InstrumentLogo symbol={stock.symbol} name={stock.name} size="sm" />
                              <div>
                                <span className="font-bold text-text-primary block group-hover:text-accent transition-colors text-xs sm:text-sm">{stock.symbol}</span>
                                <span className="text-[11px] text-text-muted line-clamp-1 hidden sm:block">{stock.name}</span>
                              </div>
                            </Link>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">
                            <Badge variant={badgeVariant as any} size="sm">{stock.exchange}</Badge>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono font-semibold text-text-primary text-xs sm:text-sm whitespace-nowrap">
                            {curr}{stock.price < 1 ? stock.price.toFixed(4) : stock.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-4 text-right font-mono whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg ${isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                              {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-text-secondary text-xs hidden md:table-cell">
                            {stock.volume ? (stock.volume > 1e6 ? `${(stock.volume / 1e6).toFixed(1)}M` : `${(stock.volume / 1e3).toFixed(0)}K`) : '-'}
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  const added = toggleWatchlist({ symbol: stock.symbol, name: stock.name, assetType: 'stock', price: stock.price, changePercent: stock.changePercent, exchange: stock.exchange });
                                  showToast({ type: 'success', title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı', message: `${stock.symbol} ${added ? 'eklendi' : 'çıkarıldı'}.` });
                                }}
                                className={`p-1 sm:p-1.5 rounded-lg border transition-colors cursor-pointer ${checkWatchlisted(stock.symbol) ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary border-border text-text-muted hover:text-warning'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${checkWatchlisted(stock.symbol) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                              </button>
                              <div className="hidden sm:inline-flex">
                                <Link href={`/stocks/${stock.symbol}`}>
                                  <Button variant="ghost" size="sm">→</Button>
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Stocks Grid with Lazy Load */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleStocks.map((stock) => {
                const isPositive = (stock.changePercent || 0) >= 0;
                const curr = (stock.currency as string) === 'TRY' ? '₺' : (stock.currency as string) === 'EUR' ? '€' : '$';
                const isStarred = checkWatchlisted(stock.symbol);
                const badgeVariant = getBadgeVariant(stock.exchange);

                return (
                  <div key={stock.symbol} className="glass-card p-4 hover:border-accent/40 hover:shadow-lg transition-all duration-300 group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                        <InstrumentLogo symbol={stock.symbol} name={stock.name} size="md" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">{stock.symbol}</h4>
                          <span className={`font-mono text-xs font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>{isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%</span>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist({ symbol: stock.symbol, name: stock.name, assetType: 'stock', price: stock.price, changePercent: stock.changePercent, exchange: stock.exchange }); }}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${isStarred ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-warning'}`}
                      >
                        <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    </div>
                    <Link href={`/stocks/${stock.symbol}`}>
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-text-muted block">Son Fiyat</span>
                          <span className="text-sm font-bold font-mono text-text-primary">
                            {curr}{stock.price < 1 ? stock.price.toFixed(4) : stock.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        <Badge variant={badgeVariant as any} size="sm">{stock.exchange}</Badge>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite Scroll Indicator & Load More Button */}
          {visibleStocks.length < sortedStocks.length && (
            <div ref={loadMoreRef} className="py-6 flex flex-col items-center justify-center gap-2 text-center">
              <span className="text-xs text-text-muted font-medium">
                {visibleStocks.length} / {sortedStocks.length} varlık gösteriliyor
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStockLimit((prev) => Math.min(prev + 40, sortedStocks.length))}
              >
                Daha Fazla Yükle (+40)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ 3. TAB: TEFAS FUNDS ═══════════════════ */}
      {activeMarket === 'TEFAS' && (
        <div className="space-y-4">
          {/* Funds Filters */}
          <div className="glass-card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Search */}
              <div className="flex-1">
                <Input
                  placeholder="Fon kodu veya kurucu ara (örn: TI2, MAC)..."
                  value={fundSearch}
                  onChange={(e) => { setFundSearch(e.target.value); setFundLimit(30); }}
                  leftIcon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                />
              </div>
            </div>
            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {fundCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setFundLimit(30); }}
                  className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer shrink-0 text-xs ${selectedCategory === cat.id ? 'bg-accent/20 border-accent text-accent font-semibold' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Funds Content */}
          {fundsLoading ? (
            <div className="glass-card p-6"><TableSkeleton rows={8} cols={6} /></div>
          ) : fundsError ? (
            <div className="glass-card p-8 text-center text-danger"><p>{fundsError}</p></div>
          ) : sortedFunds.length === 0 ? (
            <div className="glass-card p-12 text-center text-text-muted space-y-2">
              <svg className="w-12 h-12 mx-auto text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-base font-medium text-text-secondary">Kriterlere uygun TEFAS fonu bulunamadı.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* Funds Table */
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-secondary/80 text-text-muted text-[11px] sm:text-xs uppercase tracking-wider border-b border-border/80">
                    <tr>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold">Fon Kodu</th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleFundSort('price')}>
                        Fiyat {fundSortBy === 'price' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleFundSort('dailyReturn')}>
                        Günlük {fundSortBy === 'dailyReturn' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden sm:table-cell" onClick={() => toggleFundSort('monthlyReturn')}>
                        1 Ay {fundSortBy === 'monthlyReturn' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleFundSort('yearlyReturn')}>
                        1 Yıl {fundSortBy === 'yearlyReturn' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-center hidden md:table-cell cursor-pointer hover:text-text-primary" onClick={() => toggleFundSort('riskValue')}>
                        Risk {fundSortBy === 'riskValue' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {visibleFunds.map((fund) => {
                      const dailyPos = (fund.dailyReturn || 0) >= 0;
                      const yearlyPos = (fund.yearlyReturn || 0) >= 0;
                      return (
                        <tr key={fund.code} className="hover:bg-bg-hover/60 transition-colors group cursor-pointer">
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <Link href={`/funds/${fund.code}`} className="flex items-center gap-2 sm:gap-2.5">
                              <InstrumentLogo symbol={fund.code} name={fund.name} size="sm" />
                              <div>
                                <span className="font-bold text-text-primary block group-hover:text-accent transition-colors text-xs sm:text-sm">{fund.code}</span>
                                <span className="text-[11px] text-text-muted line-clamp-1 hidden sm:block">{fund.name}</span>
                              </div>
                            </Link>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono font-semibold text-text-primary text-xs sm:text-sm whitespace-nowrap">
                            ₺{fund.price ? fund.price.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '-'}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-lg ${dailyPos ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                              {dailyPos ? '+' : ''}{fund.dailyReturn ? fund.dailyReturn.toFixed(2) : '0.00'}%
                            </span>
                          </td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-xs hidden sm:table-cell font-semibold ${(fund.monthlyReturn || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                            {(fund.monthlyReturn || 0) >= 0 ? '+' : ''}{fund.monthlyReturn ? fund.monthlyReturn.toFixed(2) : '0.00'}%
                          </td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-xs font-bold ${yearlyPos ? 'text-success' : 'text-danger'}`}>
                            {yearlyPos ? '+' : ''}{fund.yearlyReturn ? fund.yearlyReturn.toFixed(2) : '0.00'}%
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-center hidden md:table-cell">
                            {fund.riskValue ? (
                              <Badge variant={fund.riskValue <= 2 ? 'success' : fund.riskValue <= 4 ? 'warning' : 'danger'} size="sm">
                                Risk {fund.riskValue}/7
                              </Badge>
                            ) : '-'}
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  const added = toggleWatchlist({ symbol: fund.code, name: fund.name, assetType: 'fund', price: fund.price || 0, changePercent: fund.dailyReturn || 0, exchange: 'TEFAS' as any });
                                  showToast({ type: 'success', title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı', message: `${fund.code} ${added ? 'eklendi' : 'çıkarıldı'}.` });
                                }}
                                className={`p-1 sm:p-1.5 rounded-lg border transition-colors cursor-pointer ${checkWatchlisted(fund.code) ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary border-border text-text-muted hover:text-warning'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${checkWatchlisted(fund.code) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                              </button>
                              <div className="hidden sm:inline-flex">
                                <Link href={`/funds/${fund.code}`}>
                                  <Button variant="ghost" size="sm">→</Button>
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Funds Grid */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleFunds.map((fund) => {
                const dailyPos = (fund.dailyReturn || 0) >= 0;
                const yearlyPos = (fund.yearlyReturn || 0) >= 0;
                const isStarred = checkWatchlisted(fund.code);
                return (
                  <div key={fund.code} className="glass-card p-4 hover:border-accent/40 hover:shadow-lg transition-all duration-300 group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/funds/${fund.code}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                        <InstrumentLogo symbol={fund.code} name={fund.name} size="md" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">{fund.code}</h4>
                          <span className={`font-mono text-xs font-semibold ${dailyPos ? 'text-success' : 'text-danger'}`}>{dailyPos ? '+' : ''}{fund.dailyReturn?.toFixed(2)}%</span>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist({ symbol: fund.code, name: fund.name, assetType: 'fund', price: fund.price || 0, changePercent: fund.dailyReturn || 0, exchange: 'TEFAS' as any }); }}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${isStarred ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-warning'}`}
                      >
                        <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    </div>
                    <Link href={`/funds/${fund.code}`}>
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-text-muted block">1 Yıllık Getiri</span>
                          <span className={`text-sm font-bold font-mono ${yearlyPos ? 'text-success' : 'text-danger'}`}>
                            {yearlyPos ? '+' : ''}{fund.yearlyReturn ? fund.yearlyReturn.toFixed(2) : '0.00'}%
                          </span>
                        </div>
                        <Badge variant="info" size="sm">TEFAS</Badge>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* TEFAS Infinite Scroll Indicator & Load More Button */}
          {visibleFunds.length < sortedFunds.length && (
            <div ref={loadMoreFundsRef} className="py-6 flex flex-col items-center justify-center gap-2 text-center">
              <span className="text-xs text-text-muted font-medium">
                {visibleFunds.length} / {sortedFunds.length} TEFAS fonu gösteriliyor
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFundLimit((prev) => Math.min(prev + 30, sortedFunds.length))}
              >
                Daha Fazla Fon Yükle (+30)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PiyasalarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-fade-in p-4">
          <div className="h-10 w-48 bg-bg-secondary rounded-xl animate-pulse" />
          <div className="h-12 w-full bg-bg-secondary rounded-2xl animate-pulse" />
          <TableSkeleton rows={10} cols={5} />
        </div>
      }
    >
      <PiyasalarContent />
    </Suspense>
  );
}
