'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import PortfolioHeatmap from '@/components/dashboard/PortfolioHeatmap';
import MarketOverview from '@/components/dashboard/MarketOverview';
import TopMovers from '@/components/dashboard/TopMovers';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import WatchlistPreview from '@/components/dashboard/WatchlistPreview';
import { ApkDownloadModal } from '@/components/ui';
import { usePortfolioStore } from '@/store/usePortfolioStore';

export default function DashboardPage() {
  const { fetchPortfoliosAndTransactions } = usePortfolioStore();
  const [showApkModal, setShowApkModal] = useState(false);

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Portfolio Hero Card */}
      <PortfolioSummary />

      {/* Portfolio Heatmap */}
      <PortfolioHeatmap />

      {/* Quick Access: Widgets & Android App */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl glass-card border border-border">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center font-bold text-sm shrink-0">
            🧩
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary block truncate">
              StockMind Canlı Widget'lar & Masaüstü
            </span>
            <span className="text-[11px] text-text-muted line-clamp-1 sm:line-clamp-none">
              Portföy ve Isı Haritası widget'larını Notion'a veya masaüstünüze ekleyin.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Link
            href="/widgets"
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-bold text-xs transition-all text-center"
          >
            Widget Merkezi &rarr;
          </Link>
          <button
            type="button"
            onClick={() => setShowApkModal(true)}
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-all cursor-pointer text-center"
          >
            📱 APK İndir
          </button>
        </div>
      </div>

      {/* Market Overview */}
      <MarketOverview />

      {/* Grid: Top Movers + Recent Transactions + Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopMovers />
        <RecentTransactions />
        <WatchlistPreview />
      </div>

      {/* APK Download Modal */}
      <ApkDownloadModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
}
