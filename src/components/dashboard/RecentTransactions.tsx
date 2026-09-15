'use client';

import Link from 'next/link';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatRelativeTime } from '@/lib/utils/format';

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
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    tx.transactionType === 'buy'
                      ? 'bg-success/15 text-success'
                      : 'bg-danger/15 text-danger'
                  }`}
                >
                  {tx.transactionType === 'buy' ? 'A' : 'S'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{tx.symbol}</p>
                  <p className="text-xs text-text-muted">
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
