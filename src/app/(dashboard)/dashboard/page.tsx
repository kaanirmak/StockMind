'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import DailyPulseRow from '@/components/dashboard/DailyPulseRow';
import PortfolioHeatmap from '@/components/dashboard/PortfolioHeatmap';
import MarketOverview from '@/components/dashboard/MarketOverview';
import TopMovers from '@/components/dashboard/TopMovers';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import WatchlistPreview from '@/components/dashboard/WatchlistPreview';
import { ApkDownloadModal } from '@/components/ui';
import { usePortfolioStore } from '@/store/usePortfolioStore';

import { useAppPlatform } from '@/hooks/useAppPlatform';

export default function DashboardPage() {
  const {
    fetchPortfoliosAndTransactions,
    transactions,
    cashMovements,
    loading,
    isSampleMode,
    setSampleMode,
  } = usePortfolioStore();
  const [showApkModal, setShowApkModal] = useState(false);
  const { canDownloadApk } = useAppPlatform();

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  const showSampleInvite = !loading && !isSampleMode && transactions.length === 0 && cashMovements.length === 0;

  return (
    <div className="dashboard-page flex flex-col gap-4 sm:gap-6 animate-fade-in pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Sample Mode Banner / Guest Invite */}
      {isSampleMode && (
        <div
          data-testid="dashboard-sample-banner"
          className="order-0 p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-bold text-amber-300">
              Örnek Portföy Deneyimi Aktif (Salt Okunur)
            </p>
            <p className="text-[11px] text-text-secondary">
              Gösterilen veriler yalnızca inceleme içindir; kendi portföy kayıtlarınıza eklenmez.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/portfolio"
              className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Detayları İncele
            </Link>
            <button
              type="button"
              onClick={() => setSampleMode(false)}
              className="px-3 py-1.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-text-primary text-xs font-semibold transition-colors cursor-pointer"
            >
              Örnekten Çık
            </button>
          </div>
        </div>
      )}

      {showSampleInvite && (
        <div
          data-testid="dashboard-sample-invite"
          className="order-0 p-3 sm:p-3.5 rounded-2xl glass-card border border-accent/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-semibold text-text-primary">
              Portföyünüz henüz boş mu? Örnek portföyü inceleyin
            </p>
            <p className="text-[11px] text-text-muted">
              Misafir olarak veya veri eklemeden önce gerçek BIST, ABD hisse ve TEFAS akışını kayıtlarınıza karıştırmadan deneyimleyin.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSampleMode(true)}
              className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Örnek Portföyü Aç
            </button>
            <Link
              href="/portfolio"
              className="px-3 py-1.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-text-primary text-xs font-semibold transition-colors"
            >
              İlk İşlemi Ekle
            </Link>
          </div>
        </div>
      )}
      {/* 1. Portfolio Hero Card */}
      <div className="order-1">
        <PortfolioSummary />
      </div>

      {/* 2. Daily Contributors & Important Event (first-fold priority on 390px mobile) */}
      <div className="order-2">
        <DailyPulseRow />
      </div>

      {/* 3. Portfolio Heatmap */}
      <div className="order-3">
        <PortfolioHeatmap />
      </div>

      {/* 4. Market Overview */}
      <div className="order-4 md:order-5">
        <MarketOverview />
      </div>

      {/* 5. Grid: Top Movers + Recent Transactions + Watchlist */}
      <div className="order-5 md:order-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopMovers />
        <RecentTransactions />
        <WatchlistPreview />
      </div>

      {/* 6. Quick Access: Widgets & Android App (demoted below core cards on mobile) */}
      <div className="order-6 md:order-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl glass-card border border-border shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center font-bold text-sm shrink-0">
            <Icon name="layers" />
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
          {canDownloadApk && (
            <button
              type="button"
              onClick={() => setShowApkModal(true)}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-all cursor-pointer text-center"
            >
              APK İndir
            </button>
          )}
        </div>
      </div>

      {/* APK Download Modal */}
      <ApkDownloadModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
}
