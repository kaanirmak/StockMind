'use client';

import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatPercent, getPnLColor, getPnLSign } from '@/lib/utils/format';

export default function PortfolioSummary() {
  const { getSummary } = usePortfolioStore();
  const summary = getSummary();

  const cards = [
    {
      label: 'Toplam Portföy Değeri',
      value: formatCurrency(summary.totalValue),
      change: null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
      gradient: 'from-accent/20 to-accent-secondary/10',
      iconBg: 'bg-accent/20 text-accent',
    },
    {
      label: 'Günlük Kar/Zarar',
      value: `${getPnLSign(summary.dailyPnL)}${formatCurrency(Math.abs(summary.dailyPnL))}`,
      change: summary.totalValue > 0 ? summary.dailyPnLPercent : null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
      gradient: 'from-success/20 to-success/5',
      iconBg: 'bg-success/20 text-success',
    },
    {
      label: 'Toplam Kar/Zarar',
      value: `${getPnLSign(summary.totalPnL)}${formatCurrency(Math.abs(summary.totalPnL))}`,
      change: summary.totalCost > 0 ? summary.totalPnLPercent : null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-accent-secondary/20 to-accent-secondary/5',
      iconBg: 'bg-accent-secondary/20 text-accent-secondary',
    },
    {
      label: 'Toplam Yatırım Tutarı',
      value: formatCurrency(summary.totalCost),
      change: null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      ),
      gradient: 'from-info/20 to-info/5',
      iconBg: 'bg-info/20 text-info',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
      {cards.map((card) => (
        <div key={card.label} className="glass-card p-5 relative overflow-hidden">
          {/* Gradient background glow */}
          <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`} />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary font-medium">{card.label}</span>
              <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                {card.icon}
              </div>
            </div>
            <div className="text-xl font-bold text-text-primary">{card.value}</div>
            {card.change !== null ? (
              <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${getPnLColor(card.change)}`}>
                {card.change > 0 ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                  </svg>
                )}
                {formatPercent(Math.abs(card.change))}
              </div>
            ) : (
              <div className="text-xs text-text-muted mt-1">
                {summary.holdings.length === 0 ? 'Varlık eklenmedi' : `${summary.holdings.length} varlık`}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
