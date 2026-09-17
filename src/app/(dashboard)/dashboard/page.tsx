'use client';

import React, { useEffect } from 'react';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import PortfolioHeatmap from '@/components/dashboard/PortfolioHeatmap';
import MarketOverview from '@/components/dashboard/MarketOverview';
import TopMovers from '@/components/dashboard/TopMovers';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import WatchlistPreview from '@/components/dashboard/WatchlistPreview';
import { usePortfolioStore } from '@/store/usePortfolioStore';

export default function DashboardPage() {
  const { fetchPortfoliosAndTransactions } = usePortfolioStore();

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Portfolio Hero Card */}
      <PortfolioSummary />

      {/* Portfolio Heatmap */}
      <PortfolioHeatmap />

      {/* Market Overview */}
      <MarketOverview />

      {/* Grid: Top Movers + Recent Transactions + Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopMovers />
        <RecentTransactions />
        <WatchlistPreview />
      </div>
    </div>
  );
}
