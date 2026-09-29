import React, { useState } from 'react';
import Link from 'next/link';
import { Holding } from '@/types/portfolio';
import { Badge, Button } from '@/components/ui';

export interface HoldingsTableProps {
  holdings: Holding[];
  onAddTransaction: () => void;
}

// Mini SVG Sparkline Component
function MiniSparkline({ changePercent }: { changePercent: number }) {
  const isPositive = changePercent >= 0;
  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const fillColor = isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';

  // Generate 6 sample path coordinates based on change
  const p1 = 14;
  const p2 = isPositive ? 13 : 15;
  const p3 = isPositive ? 11 : 16;
  const p4 = isPositive ? 12 : 14;
  const p5 = isPositive ? 8 : 18;
  const p6 = isPositive ? 5 : 22;

  const path = `M 0,${p1} Q 10,${p2} 20,${p3} T 40,${p4} T 55,${p5} T 70,${p6}`;
  const areaPath = `${path} L 70,26 L 0,26 Z`;

  return (
    <svg className="w-16 h-7 shrink-0 overflow-visible" viewBox="0 0 70 26">
      <path d={areaPath} fill={fillColor} />
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Helper to determine asset badge styling
function getAssetBadgeInfo(h: Holding) {
  const sym = h.symbol.toUpperCase();
  if (sym.includes('ALTIN') || sym.includes('GOLD')) {
    return {
      bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      label: 'Emtia / Altın',
      icon: '🟡',
    };
  }
  if (sym.includes('GUMUS') || sym.includes('SILVER')) {
    return {
      bg: 'bg-slate-400/15 border-slate-400/30 text-slate-200',
      label: 'Emtia / Gümüş',
      icon: '⚪',
    };
  }
  if (h.assetType === 'fund') {
    return {
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      label: 'TEFAS Fon',
      icon: '📈',
    };
  }
  if (h.originalCurrency === 'USD') {
    return {
      bg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
      label: 'ABD Hisse',
      icon: '🌐',
    };
  }
  return {
    bg: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
    label: 'BIST Hisse',
    icon: '📊',
  };
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({ holdings, onAddTransaction }) => {
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  const toggleExpand = (sym: string) => {
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  };

  if (holdings.length === 0) {
    return (
      <div className="glass-card p-8 sm:p-12 text-center text-text-muted space-y-3">
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
      {/* ═══════════════════════════════════════════
          MOBILE CARD VIEW (md:hidden) — Touch-friendly, clean & compact
          ═══════════════════════════════════════════ */}
      <div className="md:hidden divide-y divide-border/50">
        {/* Mobile Header Summary Pill */}
        <div className="p-3 bg-bg-secondary/70 flex items-center justify-between text-xs font-semibold">
          <span className="text-text-muted">{holdings.length} Varlık Bulunuyor</span>
          <div className="flex items-center gap-2">
            <span className="text-text-primary font-bold">₺{totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isTotalProfit ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
              {isTotalProfit ? '+' : ''}{totalPnLPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* List of Asset Cards */}
        {holdings.map((h) => {
          const isProfit = h.pnl >= 0;
          const link = h.assetType === 'stock' ? `/stocks/${h.symbol}` : `/funds/${h.symbol}`;
          const dailyChange = h.dailyChangePercent || 0;
          const badgeInfo = getAssetBadgeInfo(h);
          const isExpanded = expandedSymbols.has(h.symbol);
          const hasLots = h.lots && h.lots.length > 0;

          return (
            <div key={`m-${h.assetType}-${h.symbol}`} className="p-4 hover:bg-bg-hover/60 transition-colors">
              {/* Top Row: Symbol, Exchange & Weight */}
              <div className="flex items-center justify-between mb-3">
                <Link href={link} className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs ${badgeInfo.bg}`}>
                    {h.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-text-primary">{h.symbol}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full border font-semibold ${badgeInfo.bg}`}>
                        {badgeInfo.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted line-clamp-1">
                      {h.exchange || (h.assetType === 'fund' ? 'Yatırım Fonu' : 'Borsa İstanbul')}
                    </span>
                  </div>
                </Link>

                {/* Sparkline & Weight badge */}
                <div className="flex items-center gap-2">
                  <MiniSparkline changePercent={dailyChange} />
                  <span className="text-[11px] font-semibold text-text-muted px-2 py-0.5 rounded-full bg-bg-tertiary border border-border">
                    %{h.weight.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Middle Grid: Price, Quantity, Cost & Total Value */}
              <div className="grid grid-cols-2 gap-2 text-xs py-2 px-2.5 rounded-xl bg-bg-secondary/50 border border-border/40 mb-2.5 font-mono">
                <div>
                  <span className="text-[10px] text-text-muted block font-sans">Son Fiyat</span>
                  <div className="flex items-center gap-1 font-bold text-text-primary mt-0.5">
                    <span>₺{h.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: h.assetType === 'fund' ? 4 : 2 })}</span>
                    {dailyChange !== 0 && (
                      <span className={`text-[10px] ${dailyChange >= 0 ? 'text-success' : 'text-danger'}`}>
                        {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-text-muted block font-sans">Ort. Maliyet</span>
                  <span className="text-text-secondary font-medium mt-0.5 block">
                    ₺{h.averageCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: h.assetType === 'fund' ? 4 : 2 })}
                  </span>
                </div>
              </div>

              {/* Bottom Row: Profit / Loss Pill & FIFO Lots Drawer Trigger */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted font-medium">Toplam Getiri:</span>
                  <div className={`flex items-center gap-1.5 font-bold font-mono ${isProfit ? 'text-success' : 'text-danger'}`}>
                    <span>{isProfit ? '+' : ''}₺{h.pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isProfit ? 'bg-success/15' : 'bg-danger/15'}`}>
                      {isProfit ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {hasLots && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(h.symbol)}
                    className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline cursor-pointer"
                  >
                    <span>{isExpanded ? 'Lotları Gizle' : `FIFO (${h.lots!.length} Lot)`}</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Mobile Accordion: FIFO Lots Breakdown */}
              {isExpanded && hasLots && (
                <div className="mt-3 p-3 rounded-xl bg-bg-tertiary/70 border border-border/60 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-text-primary text-[11px] border-b border-border/40 pb-1.5">
                    <span>FIFO Alış Lotları</span>
                    <span className="text-text-muted font-normal text-[10px]">{h.lots!.length} aktif lot</span>
                  </div>
                  <div className="space-y-1.5">
                    {h.lots!.map((lot, idx) => {
                      const lotCostPerShare = lot.shares > 0 ? lot.costTry / lot.shares : 0;
                      const lotVal = lot.shares * h.currentPrice;
                      const lotPnL = lotVal - lot.costTry;
                      const lotProfit = lotPnL >= 0;
                      return (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0 font-mono text-[11px]">
                          <div>
                            <span className="text-text-muted block text-[10px] font-sans">{lot.date || 'İlk Lot'}</span>
                            <span className="font-semibold text-text-primary">{lot.shares.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} Adet</span>
                          </div>
                          <div className="text-right">
                            <span className="text-text-secondary block">₺{lotCostPerShare.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className={`text-[10px] font-bold ${lotProfit ? 'text-success' : 'text-danger'}`}>
                              {lotProfit ? '+' : ''}₺{lotPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP TABLE VIEW (hidden md:block) — Full 10-Column Table with FIFO Accordion
          ═══════════════════════════════════════════ */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-secondary/80 text-text-muted text-xs uppercase tracking-wider border-b border-border/80">
            <tr>
              <th className="py-3.5 px-3 w-8"></th>
              <th className="py-3.5 px-3 font-semibold">Varlık / Sembol</th>
              <th className="py-3.5 px-3 font-semibold">Tür</th>
              <th className="py-3.5 px-3 font-semibold text-center">7G Trend</th>
              <th className="py-3.5 px-3 font-semibold text-right">Adet / Pay</th>
              <th className="py-3.5 px-3 font-semibold text-right">Ort. Maliyet (TL)</th>
              <th className="py-3.5 px-3 font-semibold text-right">Son Fiyat (TL)</th>
              <th className="py-3.5 px-3 font-semibold text-right">Maliyet Tutarı</th>
              <th className="py-3.5 px-3 font-semibold text-right">Piyasa Değeri</th>
              <th className="py-3.5 px-3 font-semibold text-right">Kar / Zarar</th>
              <th className="py-3.5 px-3 font-semibold text-right">Ağırlık</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {holdings.map((h) => {
              const isProfit = h.pnl >= 0;
              const link = h.assetType === 'stock' ? `/stocks/${h.symbol}` : `/funds/${h.symbol}`;
              const dailyChange = h.dailyChangePercent || 0;
              const isUsd = h.originalCurrency === 'USD';
              const badgeInfo = getAssetBadgeInfo(h);
              const isExpanded = expandedSymbols.has(h.symbol);
              const hasLots = h.lots && h.lots.length > 0;

              return (
                <React.Fragment key={`${h.assetType}-${h.symbol}`}>
                  <tr className="hover:bg-bg-hover/60 transition-colors group">
                    {/* Expand/Collapse Chevron for FIFO Lots */}
                    <td className="py-3.5 px-3 text-center">
                      {hasLots ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(h.symbol)}
                          className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent transition-colors cursor-pointer"
                          title={isExpanded ? 'Lotları Gizle' : 'FIFO Alış Lotlarını İncele'}
                        >
                          <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="w-4 h-4 inline-block" />
                      )}
                    </td>

                    {/* Symbol & Name with Asset Badge */}
                    <td className="py-3.5 px-3">
                      <Link href={link} className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs ${badgeInfo.bg}`}>
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
                            {h.exchange || (h.assetType === 'fund' ? 'TEFAS' : 'Borsa İstanbul')}
                          </span>
                        </div>
                      </Link>
                    </td>

                    {/* Asset Type Badge */}
                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${badgeInfo.bg}`}>
                        <span>{badgeInfo.icon}</span>
                        <span>{badgeInfo.label}</span>
                      </span>
                    </td>

                    {/* 7-Day Mini Sparkline */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex justify-center">
                        <MiniSparkline changePercent={dailyChange} />
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-3 text-right font-mono text-text-primary font-medium">
                      {h.totalQuantity.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                    </td>

                    {/* Average Cost */}
                    <td className="py-3.5 px-3 text-right font-mono">
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

                    {/* Current Price */}
                    <td className="py-3.5 px-3 text-right font-mono">
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

                    {/* Total Cost */}
                    <td className="py-3.5 px-3 text-right font-mono text-text-secondary font-medium">
                      ₺{h.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Current Value */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-text-primary">
                      ₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* P&L */}
                    <td className="py-3.5 px-3 text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span className={`font-bold text-xs ${isProfit ? 'text-success' : 'text-danger'}`}>
                          {isProfit ? '+' : ''}₺{h.pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isProfit ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                          {isProfit ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                        </span>
                      </div>
                    </td>

                    {/* Weight */}
                    <td className="py-3.5 px-3 text-right font-mono text-text-secondary font-semibold">
                      %{h.weight.toFixed(1)}
                    </td>
                  </tr>

                  {/* FIFO Lots Expansion Row */}
                  {isExpanded && hasLots && (
                    <tr className="bg-bg-tertiary/40 border-b border-border/60">
                      <td colSpan={11} className="py-3 px-6">
                        <div className="rounded-xl border border-border/60 bg-bg-card/90 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-text-primary">
                                FIFO Alış Lotları Detayı ({h.symbol})
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold border border-accent/25">
                                {h.lots!.length} Aktif Lot
                              </span>
                            </div>
                            <span className="text-[11px] text-text-muted">
                              Satış yapıldığında ilk alınan lotlardan sırayla düşülür (FIFO)
                            </span>
                          </div>

                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-text-muted border-b border-border/40 text-[11px]">
                                <th className="py-1.5 text-left font-medium"># Lot</th>
                                <th className="py-1.5 text-left font-medium">Alış Tarihi</th>
                                <th className="py-1.5 text-right font-medium">Kalan Pay</th>
                                <th className="py-1.5 text-right font-medium">Birim Alış Maliyeti</th>
                                <th className="py-1.5 text-right font-medium">Lot Toplam Maliyeti</th>
                                <th className="py-1.5 text-right font-medium">Güncel Piyasa Değeri</th>
                                <th className="py-1.5 text-right font-medium">Lot Kâr / Zarar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20 font-mono">
                              {h.lots!.map((lot, idx) => {
                                const lotCostPerShare = lot.shares > 0 ? lot.costTry / lot.shares : 0;
                                const lotVal = lot.shares * h.currentPrice;
                                const lotPnL = lotVal - lot.costTry;
                                const lotProfit = lotPnL >= 0;
                                const lotPnLPct = lot.costTry > 0 ? (lotPnL / lot.costTry) * 100 : 0;
                                return (
                                  <tr key={idx} className="hover:bg-bg-hover/40 transition-colors">
                                    <td className="py-2 text-text-muted font-sans font-medium">Lot #{idx + 1}</td>
                                    <td className="py-2 text-text-primary font-sans">{lot.date || '-'}</td>
                                    <td className="py-2 text-right font-semibold text-text-primary">
                                      {lot.shares.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                                    </td>
                                    <td className="py-2 text-right text-text-secondary">
                                      ₺{lotCostPerShare.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: h.assetType === 'fund' ? 4 : 2 })}
                                    </td>
                                    <td className="py-2 text-right text-text-secondary">
                                      ₺{lot.costTry.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2 text-right font-bold text-text-primary">
                                      ₺{lotVal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2 text-right">
                                      <span className={`font-bold ${lotProfit ? 'text-success' : 'text-danger'}`}>
                                        {lotProfit ? '+' : ''}₺{lotPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        {' '}({lotProfit ? '+' : ''}{lotPnLPct.toFixed(1)}%)
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-bg-secondary/90 border-t-2 border-border text-xs font-semibold text-text-primary">
            <tr>
              <td className="py-3.5 px-3 uppercase tracking-wider text-text-muted" colSpan={4}>
                Toplam ({holdings.length} Varlık)
              </td>
              <td className="py-3.5 px-3 text-right font-mono text-text-muted">-</td>
              <td className="py-3.5 px-3 text-right font-mono text-text-muted">-</td>
              <td className="py-3.5 px-3 text-right font-mono text-text-muted">-</td>
              <td className="py-3.5 px-3 text-right font-mono text-text-secondary">
                ₺{totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-3.5 px-3 text-right font-mono font-bold text-text-primary">
                ₺{totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-3.5 px-3 text-right font-mono">
                <div className="flex flex-col items-end">
                  <span className={`font-bold text-xs ${isTotalProfit ? 'text-success' : 'text-danger'}`}>
                    {isTotalProfit ? '+' : ''}₺{totalPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isTotalProfit ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                    {isTotalProfit ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                  </span>
                </div>
              </td>
              <td className="py-3.5 px-3 text-right font-mono text-text-secondary">
                %100.0
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
