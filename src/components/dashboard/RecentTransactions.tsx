'use client';

import Link from 'next/link';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatRelativeTime } from '@/lib/utils/format';
import { InstrumentLogo } from '@/components/ui';

export default function RecentTransactions() {
  const { transactions } = usePortfolioStore();
  const recentTx = transactions.slice(0, 5);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary">Son İşlemler</h3>
        <Link href="/portfolio" className="text-xs text-accent hover:text-accent-hover transition-colors">
          Tümünü Gör →
        </Link>
      </div>

      {recentTx.length === 0 ? (
        <div className="text-center py-8 text-text-muted space-y-2">
          <p className="text-xs">Henüz bir alım/satım işlemi yapmadınız.</p>
          <Link
            href="/portfolio"
            className="inline-block text-xs text-accent hover:underline font-medium"
          >
            + İlk İşleminizi Ekleyin
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {recentTx.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <InstrumentLogo symbol={tx.symbol} size="sm" />
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border border-bg-primary ${
                      tx.transactionType === 'buy'
                        ? 'bg-success text-white'
                        : 'bg-danger text-white'
                    }`}
                    title={tx.transactionType === 'buy' ? 'Alış' : 'Satış'}
                  >
                    {tx.transactionType === 'buy' ? 'A' : 'S'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary leading-tight">{tx.symbol}</p>
                  <p className="text-[11px] text-text-muted">
                    {tx.quantity} adet × ₺{tx.price.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-text-primary">
                  {formatCurrency(tx.quantity * tx.price)}
                </p>
                <p className="text-xs text-text-muted">
                  {formatRelativeTime(tx.transactionDate || tx.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
