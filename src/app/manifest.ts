import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StockMind — Akıllı Portföy & Piyasa Takip',
    short_name: 'StockMind',
    description: 'Borsa İstanbul, TEFAS Fonları ve Küresel Piyasa Takip & Portföy Platformu',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0b0f19',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
