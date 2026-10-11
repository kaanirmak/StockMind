import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import { AppUpdateNotifier } from '@/components/ui';

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
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-6 has-[.ai-chat-container]:p-2 has-[.ai-chat-container]:sm:p-3 has-[.ai-chat-container]:pb-0 has-[.ai-chat-container]:h-[calc(100dvh-3.5rem)] has-[.ai-chat-container]:sm:h-[calc(100dvh-4rem)] has-[.ai-chat-container]:overflow-hidden">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
