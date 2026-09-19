'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStocks, StockWithQuote } from '@/hooks/useStockData';
import { useFunds } from '@/hooks/useFunds';
import { TefasFundInfo } from '@/lib/data/funds';
import { Badge, Button, Input, TableSkeleton, useToast } from '@/components/ui';
import { useWatchlistStore } from '@/store/useWatchlistStore';

type TabId = 'stocks' | 'funds';

function PiyasalarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get('tab') as TabId) || 'stocks';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Stocks state
  const [selectedExchange, setSelectedExchange] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [stockSearch, setStockSearch] = useState<string>('');
  const [stockSortBy, setStockSortBy] = useState<'changePercent' | 'price' | 'volume' | 'marketCap'>('changePercent');
  const [stockSortOrder, setStockSortOrder] = useState<'asc' | 'desc'>('desc');

  // Funds state
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [fundSearch, setFundSearch] = useState<string>('');
  const [fundPage, setFundPage] = useState<number>(1);
  const fundPageSize = 40;
  const [fundSortBy, setFundSortBy] = useState<'dailyReturn' | 'monthlyReturn' | 'return3m' | 'yearlyReturn' | 'return3y' | 'return5y' | 'price' | 'riskValue'>('yearlyReturn');
  const [fundSortOrder, setFundSortOrder] = useState<'asc' | 'desc'>('desc');

  // Shared view mode
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const { showToast } = useToast();
  const { toggleWatchlist, isWatchlisted: checkWatchlisted } = useWatchlistStore();

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    router.replace(`/piyasalar?tab=${tab}`, { scroll: false });
  };

  // Stocks data
  const { stocks, loading: stocksLoading, error: stocksError } = useStocks({
    exchange: selectedExchange,
    sector: selectedSector,
    search: stockSearch,
  });

  const sortedStocks = [...stocks].sort((a, b) => {
    const valA = a[stockSortBy] || 0;
    const valB = b[stockSortBy] || 0;
    return stockSortOrder === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
  });

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
    return fundSortOrder === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
  });
  const totalFundPages = Math.ceil(sortedFunds.length / fundPageSize);
  const paginatedFunds = sortedFunds.slice((fundPage - 1) * fundPageSize, fundPage * fundPageSize);

  const toggleFundSort = (column: typeof fundSortBy) => {
    if (fundSortBy === column) setFundSortOrder(fundSortOrder === 'desc' ? 'asc' : 'desc');
    else { setFundSortBy(column); setFundSortOrder('desc'); }
    setFundPage(1);
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

  const getRiskBadge = (risk: number) => {
    if (risk <= 2) return <Badge variant="success" size="sm">Risk {risk}/7</Badge>;
    if (risk <= 4) return <Badge variant="warning" size="sm">Risk {risk}/7</Badge>;
    return <Badge variant="danger" size="sm">Risk {risk}/7</Badge>;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Piyasalar</h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Hisse senetleri ve TEFAS yatırım fonlarını tek ekrandan takip edin.
          </p>
        </div>
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-accent/15 border-accent text-accent' : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'}`}
            title="Tablo"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-accent/15 border-accent text-accent' : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'}`}
            title="Kart"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-xl border border-border w-full">
        <button
          onClick={() => handleTabChange('stocks')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === 'stocks' ? 'bg-accent text-white shadow-lg shadow-accent/25' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
          <span>Hisse Senetleri</span>
          {!stocksLoading && <span className="text-[10px] opacity-70 hidden sm:inline">({stocks.length})</span>}
        </button>
        <button
          onClick={() => handleTabChange('funds')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === 'funds' ? 'bg-accent text-white shadow-lg shadow-accent/25' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
          <span>TEFAS Fonları</span>
          {!fundsLoading && <span className="text-[10px] opacity-70 hidden sm:inline">({funds.length})</span>}
        </button>
      </div>

      {/* ═══════════════════ STOCKS TAB ═══════════════════ */}
      {activeTab === 'stocks' && (
        <div className="space-y-4">
          {/* Stocks Filters */}
          <div className="glass-card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Exchange Filter */}
              <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-xl border border-border overflow-x-auto flex-1 sm:flex-none">
                {[
                  { id: 'ALL', label: 'Tümü' },
                  { id: 'BIST', label: '🇹🇷 BIST' },
                  { id: 'NASDAQ', label: '🇺🇸 NASDAQ' },
                  { id: 'NYSE', label: '🇺🇸 NYSE' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedExchange(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${selectedExchange === tab.id ? 'bg-accent text-white shadow' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="flex-1">
                <Input
                  placeholder="Sembol veya şirket ara..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  leftIcon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                />
              </div>
            </div>
            {/* Sector Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-text-muted text-[11px] shrink-0 font-medium">Sektör:</span>
              {sectors.map((sector) => (
                <button
                  key={sector}
                  onClick={() => setSelectedSector(sector)}
                  className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] ${selectedSector === sector ? 'bg-accent/20 border-accent text-accent font-semibold' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'}`}
                >
                  {sector === 'ALL' ? 'Tümü' : sector}
                </button>
              ))}
            </div>
          </div>

          {/* Stocks Content */}
          {stocksLoading ? (
            <div className="glass-card p-6"><TableSkeleton rows={8} cols={6} /></div>
          ) : stocksError ? (
            <div className="glass-card p-8 text-center text-danger"><p>{stocksError}</p></div>
          ) : sortedStocks.length === 0 ? (
            <div className="glass-card p-12 text-center text-text-muted space-y-2">
              <svg className="w-12 h-12 mx-auto text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-base font-medium text-text-secondary">Kriterlere uygun hisse bulunamadı.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* Stocks Table */
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
                    <tr>
                      <th className="py-3 px-3 sm:px-4 font-semibold">Sembol</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold hidden sm:table-cell">Borsa</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleStockSort('price')}>
                        Fiyat {stockSortBy === 'price' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleStockSort('changePercent')}>
                        Değişim {stockSortBy === 'changePercent' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden md:table-cell" onClick={() => toggleStockSort('volume')}>
                        Hacim {stockSortBy === 'volume' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {sortedStocks.map((stock) => {
                      const isPositive = stock.changePercent >= 0;
                      const curr = stock.currency === 'TRY' ? '₺' : '$';
                      return (
                        <tr key={stock.symbol} className="hover:bg-bg-hover/60 transition-colors group cursor-pointer">
                          <td className="py-3 px-3 sm:px-4">
                            <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center font-bold text-xs text-text-primary group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                                {stock.symbol.substring(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-text-primary block group-hover:text-accent transition-colors text-xs sm:text-sm">{stock.symbol}</span>
                                <span className="text-[11px] text-text-muted line-clamp-1 hidden sm:block">{stock.name}</span>
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                            <Badge variant={stock.exchange === 'BIST' ? 'purple' : 'info'} size="sm">{stock.exchange}</Badge>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-mono font-semibold text-text-primary text-xs sm:text-sm">
                            {curr}{stock.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-mono">
                            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg ${isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                              {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-mono text-text-secondary text-xs hidden md:table-cell">
                            {stock.volume ? (stock.volume > 1e6 ? `${(stock.volume / 1e6).toFixed(1)}M` : `${(stock.volume / 1e3).toFixed(0)}K`) : '-'}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  const added = toggleWatchlist({ symbol: stock.symbol, name: stock.name, assetType: 'stock', price: stock.price, changePercent: stock.changePercent, exchange: stock.exchange });
                                  showToast({ type: 'success', title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı', message: `${stock.symbol} ${added ? 'eklendi' : 'çıkarıldı'}.` });
                                }}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${checkWatchlisted(stock.symbol) ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary border-border text-text-muted hover:text-warning'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${checkWatchlisted(stock.symbol) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                              </button>
                              <Link href={`/stocks/${stock.symbol}`}>
                                <Button variant="ghost" size="sm">→</Button>
                              </Link>
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
            /* Stocks Grid */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedStocks.map((stock) => {
                const isPositive = stock.changePercent >= 0;
                const curr = stock.currency === 'TRY' ? '₺' : '$';
                const isStarred = checkWatchlisted(stock.symbol);
                return (
                  <div key={stock.symbol} className="glass-card p-4 hover:border-accent/40 hover:shadow-lg transition-all duration-300 group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-bg-tertiary flex items-center justify-center font-bold text-xs text-text-primary group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                          {stock.symbol.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">{stock.symbol}</h4>
                          <span className={`font-mono text-xs font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>{isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
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
                          <span className="text-sm font-bold font-mono text-text-primary">{curr}{stock.price.toFixed(2)}</span>
                        </div>
                        <Badge variant={stock.exchange === 'BIST' ? 'purple' : 'info'} size="sm">{stock.exchange}</Badge>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ FUNDS TAB ═══════════════════ */}
      {activeTab === 'funds' && (
        <div className="space-y-4">
          {/* Funds Filters */}
          <div className="glass-card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Search */}
              <div className="flex-1">
                <Input
                  placeholder="Fon kodu veya kurucu ara (örn: TI2, MAC)..."
                  value={fundSearch}
                  onChange={(e) => { setFundSearch(e.target.value); setFundPage(1); }}
                  leftIcon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                />
              </div>
            </div>
            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {fundCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setFundPage(1); }}
                  className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] font-medium ${selectedCategory === cat.id ? 'bg-accent/20 border-accent text-accent font-semibold' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Funds Content */}
          {fundsLoading ? (
            <div className="glass-card p-6"><TableSkeleton rows={8} cols={7} /></div>
          ) : fundsError ? (
            <div className="glass-card p-8 text-center text-danger"><p>{fundsError}</p></div>
          ) : sortedFunds.length === 0 ? (
            <div className="glass-card p-12 text-center text-text-muted">
              <p className="text-base font-medium text-text-secondary">Kriterlere uygun fon bulunamadı.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* Funds Table */
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
                    <tr>
                      <th className="py-3 px-3 sm:px-4 font-semibold whitespace-nowrap">Fon</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => toggleFundSort('price')}>
                        Fiyat {fundSortBy === 'price' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => toggleFundSort('dailyReturn')}>
                        Günlük {fundSortBy === 'dailyReturn' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary font-bold text-accent whitespace-nowrap hidden sm:table-cell" onClick={() => toggleFundSort('yearlyReturn')}>
                        1 Yıl {fundSortBy === 'yearlyReturn' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary whitespace-nowrap hidden md:table-cell" onClick={() => toggleFundSort('return3y')}>
                        3 Yıl {fundSortBy === 'return3y' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-center cursor-pointer hover:text-text-primary whitespace-nowrap hidden sm:table-cell" onClick={() => toggleFundSort('riskValue')}>
                        Risk {fundSortBy === 'riskValue' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {paginatedFunds.map((fund) => {
                      const isDailyPos = fund.dailyReturn >= 0;
                      return (
                        <tr key={fund.code} className="hover:bg-bg-hover/60 transition-colors group cursor-pointer">
                          <td className="py-3 px-3 sm:px-4">
                            <Link href={`/funds/${fund.code}`} className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center shrink-0 leading-none text-center p-1">
                                {fund.code}
                              </div>
                              <div>
                                <span className="font-bold text-text-primary block group-hover:text-accent transition-colors text-xs sm:text-sm">{fund.code}</span>
                                <span className="text-[11px] text-text-muted line-clamp-1 max-w-[140px] sm:max-w-xs hidden sm:block">{fund.name}</span>
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-mono font-semibold text-text-primary text-xs sm:text-sm">₺{fund.price.toFixed(4)}</td>
                          <td className="py-3 px-3 sm:px-4 text-right font-mono">
                            <span className={`font-semibold text-xs px-1.5 py-0.5 rounded ${isDailyPos ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                              {isDailyPos ? '+' : ''}{fund.dailyReturn.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-success text-xs sm:text-sm hidden sm:table-cell">+{fund.yearlyReturn.toFixed(1)}%</td>
                          <td className="py-3 px-3 sm:px-4 text-right font-mono text-accent text-xs hidden md:table-cell">+{fund.return3y.toFixed(0)}%</td>
                          <td className="py-3 px-3 sm:px-4 text-center hidden sm:table-cell">{getRiskBadge(fund.riskValue)}</td>
                          <td className="py-3 px-3 sm:px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  const added = toggleWatchlist({ symbol: fund.code, name: fund.name, assetType: 'fund', price: fund.price, changePercent: fund.dailyReturn, exchange: 'TEFAS' });
                                  showToast({ type: 'success', title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı', message: `${fund.code} ${added ? 'eklendi' : 'çıkarıldı'}.` });
                                }}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${checkWatchlisted(fund.code) ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary border-border text-text-muted hover:text-warning'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${checkWatchlisted(fund.code) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                              </button>
                              <Link href={`/funds/${fund.code}`}>
                                <Button variant="ghost" size="sm">→</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalFundPages > 1 && (
                <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between text-xs text-text-muted">
                  <span>{sortedFunds.length} fon · Sayfa {fundPage}/{totalFundPages}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setFundPage(Math.max(1, fundPage - 1))} disabled={fundPage === 1} className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border disabled:opacity-40 cursor-pointer hover:bg-bg-hover">‹ Önceki</button>
                    <button onClick={() => setFundPage(Math.min(totalFundPages, fundPage + 1))} disabled={fundPage === totalFundPages} className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border disabled:opacity-40 cursor-pointer hover:bg-bg-hover">Sonraki ›</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Funds Grid */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginatedFunds.map((fund) => {
                const isStarred = checkWatchlisted(fund.code);
                return (
                  <div key={fund.code} className="glass-card p-4 hover:border-accent/40 hover:shadow-xl transition-all duration-300 group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/funds/${fund.code}`} className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center shrink-0 text-center p-1 leading-tight">
                          {fund.code}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">{fund.code}</h3>
                          <span className="text-[10px] text-text-muted truncate block">{fund.category?.split(' ')[0]}</span>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist({ symbol: fund.code, name: fund.name, assetType: 'fund', price: fund.price, changePercent: fund.dailyReturn, exchange: 'TEFAS' }); }}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${isStarred ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-warning'}`}
                      >
                        <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    </div>
                    <Link href={`/funds/${fund.code}`}>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-center">
                        <div className="bg-bg-tertiary/50 p-1.5 rounded-lg">
                          <span className="text-[9px] text-text-muted block">1 Yıl</span>
                          <span className="text-xs font-bold font-mono text-success">+{fund.yearlyReturn.toFixed(1)}%</span>
                        </div>
                        <div className="bg-bg-tertiary/50 p-1.5 rounded-lg">
                          <span className="text-[9px] text-text-muted block">Günlük</span>
                          <span className={`text-xs font-bold font-mono ${fund.dailyReturn >= 0 ? 'text-success' : 'text-danger'}`}>{fund.dailyReturn >= 0 ? '+' : ''}{fund.dailyReturn.toFixed(2)}%</span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PiyasalarPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-bg-card rounded-lg border border-border" />
        <div className="h-12 w-full bg-bg-card rounded-xl border border-border" />
        <div className="glass-card p-6">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-bg-secondary rounded-lg border border-border/40" />)}
          </div>
        </div>
      </div>
    }>
      <PiyasalarContent />
    </Suspense>
  );
}
