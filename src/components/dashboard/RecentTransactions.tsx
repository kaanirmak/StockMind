'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatRelativeTime } from '@/lib/utils/format';
import { InstrumentLogo } from '@/components/ui';

export default function RecentTransactions() {
  const { transactions, activePortfolioId, fetchPortfoliosAndTransactions } = usePortfolioStore();

  useEffect(() => {
    if (transactions.length === 0) {
      fetchPortfoliosAndTransactions();
    }
  }, [transactions.length, fetchPortfoliosAndTransactions]);

  // Sort descending so the most recent trades appear at the very top
  const recentTx = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    // Filter by active portfolio if available, fallback to all transactions
    let list = transactions.filter((t) => t.portfolioId === activePortfolioId);
    if (list.length === 0) {
      list = transactions;
    }

    return [...list]
      .sort((a, b) => {
        const timeA = new Date(a.transactionDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.transactionDate || b.createdAt || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [transactions, activePortfolioId]);

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
          {recentTx.map((tx) => {
            const sym = tx.currency === 'USD' ? '$' : tx.currency === 'EUR' ? '€' : '₺';
            const total = tx.quantity * tx.price + (tx.commission || 0);

            return (
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
                    <p className="text-[11px] text-text-muted font-mono">
                      {tx.quantity.toLocaleString('tr-TR')} adet × {sym}{tx.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium font-mono text-text-primary">
                    {sym}{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatRelativeTime(tx.transactionDate || tx.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
