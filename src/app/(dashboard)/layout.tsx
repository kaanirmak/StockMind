import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';

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
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
