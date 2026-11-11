import type { Metadata } from 'next';
import { WatchlistQuotes } from '@/components/watchlist/WatchlistQuotes';
import { WatchlistSync } from '@/components/watchlist/WatchlistSync';
import { QuickTransaction } from '@/components/layout/QuickTransaction';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import { AppUpdateNotifier } from '@/components/ui';
import { WatchlistAlertWatcher } from '@/components/watchlist/WatchlistAlertWatcher';
import { WebVitalsReporter } from '@/components/telemetry/WebVitalsReporter';

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-accent focus:text-white focus:font-semibold focus:shadow-lg"
      >
        Ana içeriğe atla
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 max-w-full">
        <Header />
        <AppUpdateNotifier />
        <WatchlistAlertWatcher />
        <WatchlistSync />
        <WatchlistQuotes />
        <WebVitalsReporter />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 max-w-full overflow-x-clip p-3 sm:p-4 lg:p-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 has-[.ai-chat-container]:p-0 focus:outline-none">
          {children}
        </main>
      </div>
      <MobileNav />
      <QuickTransaction />
    </div>
  );
}
