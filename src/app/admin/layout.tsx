import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StockMind Yönetici Konsolu • Biyometrik Masaüstü',
  description: 'StockMind Donanım ve Biyometri Korumalı Yönetim Merkezi',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#04060d] text-[#f1f5f9] font-sans antialiased selection:bg-indigo-500/30">
      {children}
    </div>
  );
}
