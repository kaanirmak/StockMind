export interface MobilePrimaryNavMeta {
  href: string;
  label: string;
  shortLabel?: string;
  iconKey: 'home' | 'chart' | 'wallet' | 'star' | 'sparkles';
}

export interface MobileDrawerNavMeta {
  href: string;
  label: string;
  description?: string;
  badge?: string;
  iconKey: 'newspaper' | 'bell' | 'reports' | 'cpu' | 'grid' | 'phone' | 'settings';
}

/**
 * Primary mobile bottom bar items reachable with a single tap.
 */
export const MOBILE_PRIMARY_NAV_ITEMS: readonly MobilePrimaryNavMeta[] = [
  { href: '/dashboard', label: 'Ana Sayfa', iconKey: 'home' },
  { href: '/piyasalar', label: 'Piyasa Nabzı', shortLabel: 'Piyasa', iconKey: 'chart' },
  { href: '/portfolio', label: 'Portföy', iconKey: 'wallet' },
  { href: '/watchlist', label: 'Takip Listesi', shortLabel: 'Takip', iconKey: 'star' },
  { href: '/ai-assistant', label: 'AI Asistan', iconKey: 'sparkles' },
];

/**
 * Secondary mobile drawer ("Diğer") items. News and Alarms are pinned at the top
 * so they remain immediately discoverable without scrolling.
 */
export const MOBILE_DRAWER_NAV_ITEMS: readonly MobileDrawerNavMeta[] = [
  {
    href: '/news',
    label: 'Haberler',
    description: 'Piyasa & hisse haber akışı',
    iconKey: 'newspaper',
  },
  {
    href: '/settings#notifications',
    label: 'Alarmlar',
    description: 'Fiyat alarmları & bildirim tercihleri',
    iconKey: 'bell',
  },
  {
    href: '/alerts',
    label: 'Tüm Alarmlar',
    description: 'Aktif ve duraklatılmış alarm kuralları',
    iconKey: 'bell',
  },
  { href: '/reports', label: 'Raporlar', iconKey: 'reports' },
  { href: '/quant-lab', label: 'Quant Lab', badge: 'Pro', iconKey: 'cpu' },
  { href: '/widgets', label: "Widget'lar", badge: 'Yeni', iconKey: 'grid' },
  { href: '/download', label: 'Mobil Uygulama', badge: 'iOS / APK', iconKey: 'phone' },
  { href: '/help', label: 'Yardım & Gizlilik', description: 'Diller, veri kaynakları ve gizlilik', iconKey: 'settings' },
  { href: '/settings', label: 'Ayarlar', iconKey: 'settings' },
];

export function isMobileNavHrefActive(href: string, pathname: string, currentHash = ''): boolean {
  const [basePath, hashPart] = href.split('#');
  const matchesPath = pathname === basePath || pathname.startsWith(`${basePath}/`);
  if (!matchesPath) return false;
  if (hashPart) {
    return currentHash === `#${hashPart}`;
  }
  if (href === '/settings' && currentHash === '#notifications') {
    return false;
  }
  return true;
}
