import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

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
    icon: [
      { url: '/icon-brain-dark.png', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon-brain-dark.png',
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
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
    <html lang="tr" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('stockmind_theme');
                  var theme = stored === 'light' ? 'light' : 'dark';
                  document.documentElement.classList.remove('light', 'dark');
                  document.documentElement.classList.add(theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
