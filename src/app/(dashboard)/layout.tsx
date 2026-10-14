import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import { AppUpdateNotifier } from '@/components/ui';

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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <AppUpdateNotifier />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 has-[.ai-chat-container]:p-2 has-[.ai-chat-container]:sm:p-3 has-[.ai-chat-container]:pb-2">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
