'use client';

import React from 'react';
import Link from 'next/link';
import { Holding } from '@/types/portfolio';
import { Badge, Button } from '@/components/ui';

export interface HoldingsTableProps {
  holdings: Holding[];
  onAddTransaction: () => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({ holdings, onAddTransaction }) => {
  if (holdings.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-text-muted space-y-3">
        <svg className="w-12 h-12 mx-auto text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-base font-semibold text-text-primary">Portföyünüzde henüz varlık bulunmuyor</p>
        <p className="text-xs max-w-sm mx-auto">İlk alım işleminizi ekleyerek varlıklarınızı, maliyetinizi ve kar/zararınızı anlık takip edin.</p>
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAddTransaction}>
            + İlk İşlemi Ekle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Varlık / Sembol</th>
              <th className="py-3.5 px-4 font-semibold">Tür</th>
              <th className="py-3.5 px-4 font-semibold text-right">Adet / Pay</th>
              <th className="py-3.5 px-4 font-semibold text-right">Ort. Maliyet</th>
              <th className="py-3.5 px-4 font-semibold text-right">Son Fiyat</th>
              <th className="py-3.5 px-4 font-semibold text-right">Toplam Değer</th>
              <th className="py-3.5 px-4 font-semibold text-right">Kar / Zarar</th>
              <th className="py-3.5 px-4 font-semibold text-right">Ağırlık</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {holdings.map((h) => {
              const isProfit = h.pnl >= 0;
              const link = h.assetType === 'stock' ? `/stocks/${h.symbol}` : `/funds/${h.symbol}`;

              return (
                <tr key={`${h.assetType}-${h.symbol}`} className="hover:bg-bg-hover/60 transition-colors group">
                  <td className="py-3.5 px-4">
                    <Link href={link} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center font-bold text-xs text-text-primary group-hover:bg-accent group-hover:text-white transition-colors">
                        {h.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <span className="font-bold text-text-primary block group-hover:text-accent transition-colors">
                          {h.symbol}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          {h.exchange || 'BIST'}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={h.assetType === 'stock' ? 'purple' : 'info'} size="sm">
                      {h.assetType === 'stock' ? 'Hisse' : 'TEFAS Fon'}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-text-primary font-medium">
                    {h.totalQuantity.toLocaleString('tr-TR')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-text-secondary">
                    ₺{h.averageCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-text-primary font-semibold">
                    ₺{h.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                    ₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    <div className="flex flex-col items-end">
                      <span className={`font-bold text-xs ${isProfit ? 'text-success' : 'text-danger'}`}>
                        {isProfit ? '+' : ''}₺{h.pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded ${isProfit ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                        {isProfit ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-text-secondary font-semibold">
                    %{h.weight.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
