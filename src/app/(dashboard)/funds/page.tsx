'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useFunds } from '@/hooks/useFunds';
import { TefasFundInfo } from '@/lib/data/funds';
import { Badge, Button, Input, TableSkeleton, useToast } from '@/components/ui';
import { useWatchlistStore } from '@/store/useWatchlistStore';

export default function FundsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 40;

  const [sortBy, setSortBy] = useState<
    'dailyReturn' | 'monthlyReturn' | 'return3m' | 'yearlyReturn' | 'return3y' | 'return5y' | 'price' | 'riskValue'
  >('yearlyReturn');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const { showToast } = useToast();
  const { toggleWatchlist, isWatchlisted: checkWatchlisted } = useWatchlistStore();

  const { funds, loading, error } = useFunds({
    category: selectedCategory,
    search: searchQuery,
  });

  const sortedFunds = [...funds].sort((a, b) => {
    const valA = a[sortBy] || 0;
    const valB = b[sortBy] || 0;
    return sortOrder === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
  });

  const totalPages = Math.ceil(sortedFunds.length / pageSize);
  const paginatedFunds = sortedFunds.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const toggleSort = (
    column: 'dailyReturn' | 'monthlyReturn' | 'return3m' | 'yearlyReturn' | 'return3y' | 'return5y' | 'price' | 'riskValue'
  ) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const categories = [
    { id: 'ALL', label: 'Tüm Fonlar' },
    { id: 'Hisse Senedi Fonu', label: '📈 Hisse Senedi' },
    { id: 'Değişken Fon', label: '⚖️ Değişken' },
    { id: 'Fon Sepeti Fonu', label: '🌐 Yabancı / Fon Sepeti' },
    { id: 'Kıymetli Madenler Fonu', label: '🥇 Altın & Emtia' },
    { id: 'Para Piyasası Fonu', label: '💵 Para Piyasası' },
    { id: 'Borçlanma Araçları Fonu', label: '🏦 Borçlanma & Eurobond' },
  ];

  const getRiskBadge = (risk: number) => {
    if (risk <= 2) return <Badge variant="success" size="sm">Risk: {risk}/7 (Düşük)</Badge>;
    if (risk <= 4) return <Badge variant="warning" size="sm">Risk: {risk}/7 (Orta)</Badge>;
    return <Badge variant="danger" size="sm">Risk: {risk}/7 (Yüksek)</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">TEFAS Yatırım Fonları</h1>
            <Badge variant="purple" size="sm">
              {funds.length} Fon Listeleniyor
            </Badge>
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Türkiye Elektronik Fon Alım Satım Platformu fonlarını getiri, risk ve portföy dağılımına göre filtreleyin.
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
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border w-full md:w-auto overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-accent text-white shadow'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="w-full md:w-72">
            <Input
              placeholder="Fon kodu veya kurucu ara (örn: TI2, MAC)..."
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
      </div>

      {/* Content: Loading, Error or Fund Listing */}
      {loading ? (
        <div className="glass-card p-6">
          <TableSkeleton rows={8} cols={7} />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-danger">
          <p>{error}</p>
        </div>
      ) : sortedFunds.length === 0 ? (
        <div className="glass-card p-12 text-center text-text-muted space-y-2">
          <p className="text-base font-medium text-text-secondary">Aradığınız kriterlere uygun fon bulunamadı.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
                <tr>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Fon Kodu & Adı</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Kategori</th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary whitespace-nowrap"
                    onClick={() => toggleSort('price')}
                  >
                    Pay Fiyatı {sortBy === 'price' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary whitespace-nowrap"
                    onClick={() => toggleSort('dailyReturn')}
                  >
                    Günlük {sortBy === 'dailyReturn' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary whitespace-nowrap"
                    onClick={() => toggleSort('monthlyReturn')}
                  >
                    1 Ay {sortBy === 'monthlyReturn' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary font-bold text-accent whitespace-nowrap"
                    onClick={() => toggleSort('yearlyReturn')}
                  >
                    1 Yıl {sortBy === 'yearlyReturn' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden lg:table-cell whitespace-nowrap"
                    onClick={() => toggleSort('return5y')}
                  >
                    5 Yıl {sortBy === 'return5y' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3.5 px-4 font-semibold text-center cursor-pointer hover:text-text-primary whitespace-nowrap"
                    onClick={() => toggleSort('riskValue')}
                  >
                    Risk {sortBy === 'riskValue' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedFunds.map((fund) => {
                  const isDailyPos = fund.dailyReturn >= 0;
                  const isYearlyPos = fund.yearlyReturn >= 0;

                  return (
                    <tr
                      key={fund.code}
                      className="hover:bg-bg-hover/60 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <Link href={`/funds/${fund.code}`} className="block">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center">
                              {fund.code}
                            </div>
                            <div>
                              <span className="font-bold text-text-primary block group-hover:text-accent transition-colors">
                                {fund.code}
                              </span>
                              <span className="text-xs text-text-muted line-clamp-1 max-w-xs">
                                {fund.name}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs text-text-secondary bg-bg-tertiary px-2.5 py-1 rounded-lg border border-border whitespace-nowrap inline-block">
                          {fund.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-text-primary">
                        ₺{fund.price.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span
                          className={`font-semibold text-xs px-2 py-0.5 rounded ${
                            isDailyPos ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                          }`}
                        >
                          {isDailyPos ? '+' : ''}
                          {fund.dailyReturn.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-text-primary">
                        +{fund.monthlyReturn.toFixed(2)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-success">
                        +{fund.yearlyReturn.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-accent hidden lg:table-cell">
                        +{fund.return5y.toFixed(0)}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getRiskBadge(fund.riskValue)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const added = toggleWatchlist({
                                symbol: fund.code,
                                name: fund.name,
                                assetType: 'fund',
                                price: fund.price,
                                changePercent: fund.dailyReturn,
                                exchange: 'TEFAS',
                              });
                              showToast({
                                type: 'success',
                                title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı',
                                message: `${fund.code} fonu izleme listenize ${added ? 'eklendi' : 'çıkarıldı'}.`,
                              });
                            }}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              checkWatchlisted(fund.code)
                                ? 'bg-warning/20 border-warning text-warning'
                                : 'bg-bg-tertiary border-border text-text-muted hover:text-warning'
                            }`}
                            title={checkWatchlisted(fund.code) ? 'Takip Listesinden Çıkar' : 'Takip Listesine Ekle'}
                          >
                            <svg className={`w-4 h-4 ${checkWatchlisted(fund.code) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                          </button>
                          <Link href={`/funds/${fund.code}`}>
                            <Button variant="ghost" size="sm">
                              İncele &rarr;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedFunds.map((fund) => {
            const isStarred = checkWatchlisted(fund.code);
            return (
              <div
                key={fund.code}
                className="glass-card p-5 hover:border-accent/40 hover:shadow-xl transition-all duration-300 block group relative"
              >
                <div className="flex items-start justify-between">
                  <Link href={`/funds/${fund.code}`} className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-sm flex items-center justify-center">
                      {fund.code}
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary group-hover:text-accent transition-colors">
                        {fund.code}
                      </h3>
                      <span className="text-[11px] text-text-muted">{fund.category}</span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const added = toggleWatchlist({
                          symbol: fund.code,
                          name: fund.name,
                          assetType: 'fund',
                          price: fund.price,
                          changePercent: fund.dailyReturn,
                          exchange: 'TEFAS',
                        });
                        showToast({
                          type: 'success',
                          title: added ? 'Takip Listesine Eklendi ⭐' : 'Listeden Çıkarıldı',
                          message: `${fund.code} fonu izleme listenize ${added ? 'eklendi' : 'çıkarıldı'}.`,
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
                    {getRiskBadge(fund.riskValue)}
                  </div>
                </div>

                <Link href={`/funds/${fund.code}`}>
                  <p className="text-xs text-text-secondary mt-3 line-clamp-2 h-8">
                    {fund.name}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/50 text-center">
                    <div className="bg-bg-tertiary/50 p-2 rounded-lg">
                      <span className="text-[10px] text-text-muted block">Pay Fiyatı</span>
                      <span className="text-xs font-bold font-mono text-text-primary">
                        ₺{fund.price.toFixed(4)}
                      </span>
                    </div>
                    <div className="bg-bg-tertiary/50 p-2 rounded-lg">
                      <span className="text-[10px] text-text-muted block">1 Ay</span>
                      <span className="text-xs font-bold font-mono text-success">
                        +{fund.monthlyReturn.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-bg-tertiary/50 p-2 rounded-lg">
                      <span className="text-[10px] text-text-muted block">1 Yıl</span>
                      <span className="text-xs font-bold font-mono text-success">
                        +{fund.yearlyReturn.toFixed(1)}%
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
