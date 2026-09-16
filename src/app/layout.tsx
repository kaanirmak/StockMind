import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: 'StockMind — Akıllı Borsa & Fon Takip Platformu',
  description:
    'BIST, NYSE, NASDAQ hisselerini ve TEFAS fonlarını takip edin. Portföy yönetimi, teknik analiz, AI destekli öneriler ve daha fazlası.',
  keywords: [
    'borsa',
    'hisse senedi',
    'BIST',
    'TEFAS',
    'portföy',
    'yatırım',
    'teknik analiz',
    'NYSE',
    'NASDAQ',
    'StockMind',
  ],
  authors: [{ name: 'StockMind' }],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'StockMind — Akıllı Borsa & Fon Takip Platformu',
    description:
      'BIST, NYSE, NASDAQ hisselerini ve TEFAS fonlarını takip edin.',
    type: 'website',
    locale: 'tr_TR',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
