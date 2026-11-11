import type { MetadataRoute } from 'next';
import { palette } from '@/theme/palette';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StockMind — Akıllı Borsa & Fon Takip Platformu',
    short_name: 'StockMind',
    description:
      'BIST, NYSE, NASDAQ hisselerini ve TEFAS fonlarını takip edin; fiyat alarmları ve Web Push bildirimleri alın.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: palette.color0a0e1a,
    theme_color: palette.color0a0e1a,
    lang: 'tr',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
