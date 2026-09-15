'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStocks, StockWithQuote } from '@/hooks/useStockData';
import { Badge, Button, Input, Skeleton, TableSkeleton, useToast } from '@/components/ui';
import { useWatchlistStore } from '@/store/useWatchlistStore';

export default function StocksPage() {
  const [selectedExchange, setSelectedExchange] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'changePercent' | 'price' | 'volume' | 'marketCap'>('changePercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const { showToast } = useToast();
  const { toggleWatchlist, isWatchlisted: checkWatchlisted } = useWatchlistStore();

  const { stocks, loading, error } = useStocks({
    exchange: selectedExchange,
    sector: selectedSector,
    search: searchQuery,
  });

  const sortedStocks = [...stocks].sort((a, b) => {
    const valA = a[sortBy] || 0;
    const valB = b[sortBy] || 0;
    return sortOrder === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
  });

  const toggleSort = (column: 'changePercent' | 'price' | 'volume' | 'marketCap') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sectors = [
    'ALL',
    'Bankacılık',
    'Havacılık',
    'Savunma',
    'Sanayi',
    'Perakende',
    'Teknoloji',
    'Enerji',
    'Holding',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Hisse Senetleri</h1>
          <p className="text-text-secondary text-sm mt-1">
            BIST 100, NYSE ve NASDAQ hisselerini anlık takip edin, teknik analiz yapın.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-accent/15 border-accent text-accent'
                : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
            }`}
            title="Tablo Görünümü"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-accent/15 border-accent text-accent'
                : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
            }`}
            title="Kart Görünümü"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Exchange Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border w-full md:w-auto overflow-x-auto">
            {[
              { id: 'ALL', label: 'Tüm Piyasalar' },
              { id: 'BIST', label: '🇹🇷 BIST' },
              { id: 'NASDAQ', label: '🇺🇸 NASDAQ' },
              { id: 'NYSE', label: '🇺🇸 NYSE' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedExchange(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedExchange === tab.id
                    ? 'bg-accent text-white shadow'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="w-full md:w-72">
            <Input
              placeholder="Sembol veya şirket ara (örn: THYAO, AAPL)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Sector Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-text-muted text-[11px] shrink-0 font-medium">Sektör:</span>
          {sectors.map((sector) => (
            <button
              key={sector}
              onClick={() => setSelectedSector(sector)}
              className={`px-3 py-1 rounded-full border transition-all cursor-pointer shrink-0 ${
                selectedSector === sector
                  ? 'bg-accent/20 border-accent text-accent font-semibold'
                  : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'
              }`}
            >
              {sector === 'ALL' ? 'Tümü' : sector}
            </button>
          ))}
        </div>
      </div>

      {/* Content: Loading, Error or Stock Listing */}
      {loading ? (
        <div className="glass-card p-6">
          <TableSkeleton rows={8} cols={6} />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-danger space-y-3">
          <p>{error}</p>
        </div>
      ) : sortedStocks.length === 0 ? (
        <div className="glass-card p-12 text-center text-text-muted space-y-2">
          <svg className="w-12 h-12 mx-auto text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-base font-medium text-text-secondary">Aradığınız kriterlere uygun hisse bulunamadı.</p>
          <p className="text-xs">Farklı bir arama terimi veya filtre deneyebilirsiniz.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Sembol & Şirket</th>
                  <th className="py-3.5 px-4 font-semibold">Borsa</th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary"
                    onClick={() => toggleSort('price')}
                  >
                    Son Fiyat {sortBy === 'price' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary"
                    onClick={() => toggleSort('changePercent')}
                  >
                    Günlük Değişim {sortBy === 'changePercent' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden sm:table-cell"
                    onClick={() => toggleSort('volume')}
                  >
                    Hacim {sortBy === 'volume' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden lg:table-cell"
                    onClick={() => toggleSort('marketCap')}
                  >
                    Piyasa Değeri {sortBy === 'marketCap' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="py-3.5 px-4 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedStocks.map((stock) => {
                  const isPositive = stock.changePercent >= 0;
                  const currSymbol = stock.currency === 'TRY' ? '₺' : '$';

                  return (
                    <tr
                      key={stock.symbol}
                      className="hover:bg-bg-hover/60 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <Link href={`/stocks/${stock.symbol}`} className="block">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center font-bold text-xs text-text-primary group-hover:bg-accent group-hover:text-white transition-colors">
                              {stock.symbol.substring(0, 2)}
                            </div>
                            <div>
                              <span className="font-bold text-text-primary block group-hover:text-accent transition-colors">
                                {stock.symbol}
                              </span>
                              <span className="text-xs text-text-muted line-clamp-1">
                                {stock.name}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={stock.exchange === 'BIST' ? 'purple' : 'info'}
                          size="sm"
                        >
                          {stock.exchange}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-text-primary">
                        {currSymbol}
                        {stock.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-lg ${
                            isPositive
                              ? 'text-success bg-success/10'
                              : 'text-danger bg-danger/10'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-text-secondary hidden sm:table-cell">
                        {stock.volume ? (stock.volume > 1e6 ? `${(stock.volume / 1e6).toFixed(1)}M` : `${(stock.volume / 1e3).toFixed(0)}K`) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-text-secondary hidden lg:table-cell">
                        {currSymbol}
                        {(stock.marketCap / 1e9).toFixed(1)} Mr
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const added = toggleWatchlist({
                                symbol: stock.symbol,
                                name: stock.name,
                                assetType: 'stock',
                                price: stock.price,
                                changePercent: stock.changePercent,
                                exchange: stock.exchange,
                              });
                              showToast({
                                type: 'success',
                                title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı',
                                message: `${stock.symbol} izleme listenize ${added ? 'eklendi' : 'çıkarıldı'}.`,
                              });
                            }}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              checkWatchlisted(stock.symbol)
                                ? 'bg-warning/20 border-warning text-warning'
                                : 'bg-bg-tertiary border-border text-text-muted hover:text-warning'
                            }`}
                            title={checkWatchlisted(stock.symbol) ? 'Takip Listesinden Çıkar' : 'Takip Listesine Ekle'}
                          >
                            <svg className={`w-4 h-4 ${checkWatchlisted(stock.symbol) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                          </button>
                          <Link href={`/stocks/${stock.symbol}`}>
                            <Button variant="ghost" size="sm">
                              Detay &rarr;
                            </Button>
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
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedStocks.map((stock) => {
            const isPositive = stock.changePercent >= 0;
            const currSymbol = stock.currency === 'TRY' ? '₺' : '$';
            const isStarred = checkWatchlisted(stock.symbol);

            return (
              <div
                key={stock.symbol}
                className="glass-card p-5 hover:border-accent/40 hover:shadow-lg transition-all duration-300 block group relative"
              >
                <div className="flex items-start justify-between">
                  <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center font-bold text-sm text-text-primary group-hover:bg-accent group-hover:text-white transition-colors">
                      {stock.symbol.substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors">
                        {stock.symbol}
                      </h4>
                      <Badge variant={stock.exchange === 'BIST' ? 'purple' : 'info'} size="sm">
                        {stock.exchange}
                      </Badge>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const added = toggleWatchlist({
                          symbol: stock.symbol,
                          name: stock.name,
                          assetType: 'stock',
                          price: stock.price,
                          changePercent: stock.changePercent,
                          exchange: stock.exchange,
                        });
                        showToast({
                          type: 'success',
                          title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı',
                          message: `${stock.symbol} izleme listenize ${added ? 'eklendi' : 'çıkarıldı'}.`,
                        });
                      }}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isStarred
                          ? 'bg-warning/20 border-warning text-warning'
                          : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-warning'
                      }`}
                      title={isStarred ? 'Takip Listesinden Çıkar' : 'Takip Listesine Ekle'}
                    >
                      <svg className={`w-4 h-4 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </button>
                    <span
                      className={`font-mono text-xs font-semibold px-2 py-1 rounded-lg ${
                        isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {stock.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <Link href={`/stocks/${stock.symbol}`}>
                  <p className="text-xs text-text-muted mt-3 line-clamp-1">{stock.name}</p>

                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-text-muted block">Son Fiyat</span>
                      <span className="text-lg font-bold font-mono text-text-primary">
                        {currSymbol}
                        {stock.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-text-muted block">Hacim</span>
                      <span className="text-xs font-mono text-text-secondary">
                        {stock.volume ? (stock.volume > 1e6 ? `${(stock.volume / 1e6).toFixed(1)}M` : `${(stock.volume / 1e3).toFixed(0)}K`) : '-'}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
