import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import { AppUpdateNotifier } from '@/components/ui';
import { WatchlistAlertWatcher } from '@/components/watchlist/WatchlistAlertWatcher';

export const metadata: Metadata = {
  title: {
    template: '%s | StockMind',
    default: 'StockMind — Akıllı Borsa & Portföy Takip',
  },
  description: 'BIST, TEFAS fonları, küresel hisseler ve kripto portföyünüzü canlı verilerle takip edin.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-clip">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 max-w-full">
        <Header />
        <AppUpdateNotifier />
        <WatchlistAlertWatcher />
        <main className="flex-1 min-w-0 max-w-full overflow-x-clip p-3 sm:p-4 lg:p-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 has-[.ai-chat-container]:p-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
