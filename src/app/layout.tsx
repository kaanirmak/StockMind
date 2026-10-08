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
        {/* Cookie size guard: clear bloated Supabase auth cookies before they cause 494 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = document.cookie;
                  var size = new Blob([raw]).size;
                  if (size > 6144) {
                    var cookies = raw.split(';');
                    for (var i = 0; i < cookies.length; i++) {
                      var name = cookies[i].trim().split('=')[0];
                      if (name && /^sb-.+-auth-token/.test(name)) {
                        document.cookie = name + '=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                        document.cookie = name + '=; path=/; domain=' + window.location.hostname + '; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                      }
                    }
                    if (window.location.pathname !== '/login' && window.location.pathname !== '/clear-session.html') {
                      window.location.href = '/login?reason=session_too_large';
                    }
                  }
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
