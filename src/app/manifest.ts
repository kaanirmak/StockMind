import { palette } from '@/theme/palette';
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StockMind — Akıllı Portföy & Piyasa Takip',
    short_name: 'StockMind',
    description: 'Borsa İstanbul, TEFAS Fonları ve Küresel Piyasa Takip & Portföy Platformu',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: palette.black,
    theme_color: palette.primaryDark,
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
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-brain-dark.png',
        sizes: '150x130',
        type: 'image/png',
      },
    ],
    // Windows 11 Widget Board Specification (PWA Widgets)
    ...({
      widgets: [
        {
          name: 'StockMind Portföy Widget',
          short_name: 'Portföy',
          description: 'Anlık portföy durumu ve günlük/aylık getiri takibi',
          tag: 'stockmind-portfolio',
          ms_ac_template: '/widgets/portfolio',
          data: '/api/markets/overview',
          type: 'application/json',
        },
        {
          name: 'StockMind Isı Haritası',
          short_name: 'Isı Haritası',
          description: 'Canlı BIST ve portföy ağırlık ısı haritası',
          tag: 'stockmind-heatmap',
          ms_ac_template: '/widgets/heatmap',
          data: '/api/markets/overview',
          type: 'application/json',
        },
      ],
    } as any),
  };
}
