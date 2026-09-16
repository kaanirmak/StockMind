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

  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const isTotalProfit = totalPnL >= 0;

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Varlık / Sembol</th>
              <th className="py-3.5 px-4 font-semibold">Tür</th>
              <th className="py-3.5 px-4 font-semibold text-right">Adet / Pay</th>
              <th className="py-3.5 px-4 font-semibold text-right">Ort. Maliyet (TL)</th>
              <th className="py-3.5 px-4 font-semibold text-right">Son Fiyat (TL)</th>
              <th className="py-3.5 px-4 font-semibold text-right">Maliyet Tutarı</th>
              <th className="py-3.5 px-4 font-semibold text-right">Piyasa Değeri</th>
              <th className="py-3.5 px-4 font-semibold text-right">Kar / Zarar</th>
              <th className="py-3.5 px-4 font-semibold text-right">Ağırlık</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {holdings.map((h) => {
              const isProfit = h.pnl >= 0;
              const link = h.assetType === 'stock' ? `/stocks/${h.symbol}` : `/funds/${h.symbol}`;
              const dailyChange = h.dailyChangePercent || 0;
              const isUsd = h.originalCurrency === 'USD';

              return (
                <tr key={`${h.assetType}-${h.symbol}`} className="hover:bg-bg-hover/60 transition-colors group">
                  <td className="py-3.5 px-4">
                    <Link href={link} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center font-bold text-xs text-text-primary group-hover:bg-accent group-hover:text-white transition-colors">
                        {h.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-text-primary block group-hover:text-accent transition-colors">
                            {h.symbol}
                          </span>
                          {isUsd && (
                            <span className="text-[10px] font-semibold px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              USD
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-text-muted">
                          {h.exchange || (h.assetType === 'fund' ? 'TEFAS' : 'BIST')}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={h.assetType === 'stock' ? 'purple' : 'info'} size="sm">
                      {h.assetType === 'stock' ? (isUsd ? 'ABD Hisse' : 'BIST Hisse') : 'TEFAS Fon'}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-text-primary font-medium">
                    {h.totalQuantity.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    <div className="flex flex-col items-end">
                      <span className="text-text-secondary font-medium">
                        ₺{h.averageCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: h.assetType === 'fund' ? 6 : 4 })}
                      </span>
                      {isUsd && h.originalAverageCost != null && (
                        <span className="text-[10px] text-text-muted">
                          ${h.originalAverageCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-text-primary">
                        ₺{h.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: h.assetType === 'fund' ? 6 : 4 })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isUsd && h.originalPrice != null && (
                          <span className="text-[10px] text-text-muted">
                            ${h.originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        {dailyChange !== 0 && (
                          <span className={`text-[10px] font-medium ${dailyChange >= 0 ? 'text-success' : 'text-danger'}`}>
                            {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-text-secondary font-medium">
                    ₺{h.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                    ₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    <div className="flex flex-col items-end">
                      <span className={`font-bold text-xs ${isProfit ? 'text-success' : 'text-danger'}`}>
                        {isProfit ? '+' : ''}₺{h.pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isProfit ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
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
          <tfoot className="bg-bg-secondary/90 border-t-2 border-border text-xs font-semibold text-text-primary">
            <tr>
              <td className="py-3.5 px-4 uppercase tracking-wider text-text-muted" colSpan={2}>
                Toplam ({holdings.length} Varlık)
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-text-muted">-</td>
              <td className="py-3.5 px-4 text-right font-mono text-text-muted">-</td>
              <td className="py-3.5 px-4 text-right font-mono text-text-muted">-</td>
              <td className="py-3.5 px-4 text-right font-mono text-text-secondary">
                ₺{totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                ₺{totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-3.5 px-4 text-right font-mono">
                <div className="flex flex-col items-end">
                  <span className={`font-bold text-xs ${isTotalProfit ? 'text-success' : 'text-danger'}`}>
                    {isTotalProfit ? '+' : ''}₺{totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isTotalProfit ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                    {isTotalProfit ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                  </span>
                </div>
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-text-secondary">
                %100.0
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
