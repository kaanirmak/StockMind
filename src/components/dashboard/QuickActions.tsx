'use client';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';
const actions: { label: string; href?: string; icon: IconName }[] = [
  { label: 'İşlem Ekle', icon: 'plus' },
  { label: 'Takip Listesi', href: '/watchlist', icon: 'star' },
  { label: 'Piyasa Nabzı', href: '/piyasalar', icon: 'chart' },
  { label: 'AI Analizi', href: '/ai-assistant', icon: 'sparkles' },
];
export function QuickActions() {
  return <nav aria-label="Hızlı aksiyonlar" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {actions.map(({ label, href, icon }) => {
      const content = <><Icon name={icon} /><span>{label}</span></>;
      const className = 'flex items-center justify-center gap-2 min-h-12 px-3 rounded-xl bg-bg-card border border-border text-xs sm:text-sm font-semibold text-text-primary hover:border-accent hover:text-accent transition-colors';
      return href ? <Link key={label} href={href} className={className}>{content}</Link> : <button key={label} type="button" onClick={() => window.dispatchEvent(new Event('stockmind:add-transaction'))} className={className}>{content}</button>;
    })}
  </nav>;
}
