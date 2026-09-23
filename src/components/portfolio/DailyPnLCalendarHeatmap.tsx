'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, PortfolioSummary } from '@/types/portfolio';
import { getPortfolioDailyActivity, DayPnLRecord } from '@/lib/portfolio/dailyActivity';
import { formatCurrency, formatPercent } from '@/lib/utils/format';

interface DailyPnLCalendarHeatmapProps {
  portfolioId: string;
  summary: PortfolioSummary;
  transactions: Transaction[];
  className?: string;
}

export function DailyPnLCalendarHeatmap({
  portfolioId,
  summary,
  transactions,
  className = '',
}: DailyPnLCalendarHeatmapProps) {
  const [timeframe, setTimeframe] = useState<'1Y' | '6M' | 'YTD'>('1Y');
  const [hoveredDay, setHoveredDay] = useState<DayPnLRecord | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayPnLRecord | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [priceHistoryMap, setPriceHistoryMap] = useState<Record<string, Record<string, number>>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [assetFilterTab, setAssetFilterTab] = useState<'all' | 'loss' | 'gain'>('all');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch 100% REAL historical daily prices for active portfolio holdings
  useEffect(() => {
    // Collect unique symbols and their asset types
    const symbolMap = new Map<string, 'stock' | 'fund'>();
    (summary.holdings || []).forEach((h) => {
      if (h.symbol) symbolMap.set(h.symbol.toUpperCase(), h.assetType);
    });
    transactions.forEach((t) => {
      if (t.symbol) symbolMap.set(t.symbol.toUpperCase(), t.assetType || 'stock');
    });

    if (symbolMap.size === 0) return;

    let isMounted = true;
    setLoadingHistory(true);

    const fetchAllHistory = async () => {
      const historyMap: Record<string, Record<string, number>> = {};

      const promises = Array.from(symbolMap.entries()).map(async ([symbol, assetType]) => {
        try {
          if (assetType === 'fund') {
            const res = await fetch(`/api/funds/${symbol}`);
            if (res.ok) {
              const json = await res.json();
              const list = json.data?.history || [];
              const m: Record<string, number> = {};
              for (const pt of list) {
                if (pt.date && pt.price != null) {
                  m[pt.date] = Number(pt.price);
                }
              }
              historyMap[symbol] = m;
              historyMap[symbol.toUpperCase()] = m;
            }
          } else {
            const res = await fetch(`/api/stocks/${symbol}/history?timeframe=1Y`);
            if (res.ok) {
              const json = await res.json();
              const list = json.data || [];
              const m: Record<string, number> = {};
              for (const pt of list) {
                const dStr = pt.time || pt.date;
                if (dStr && pt.close != null) {
                  m[dStr] = Number(pt.close);
                }
              }
              historyMap[symbol] = m;
              historyMap[symbol.toUpperCase()] = m;
            }
          }
        } catch (err) {
          console.warn(`[DailyPnLHeatmap] Could not fetch real history for ${symbol}:`, err);
        }
      });

      await Promise.all(promises);

      if (isMounted) {
        setPriceHistoryMap(historyMap);
        setLoadingHistory(false);
      }
    };

    fetchAllHistory();

    return () => {
      isMounted = false;
    };
  }, [summary.holdings, transactions]);

  // Compute heatmap data using strictly REAL data
  const heatmapData = useMemo(() => {
    return getPortfolioDailyActivity(portfolioId, summary, transactions, timeframe, priceHistoryMap);
  }, [portfolioId, summary, transactions, timeframe, priceHistoryMap]);

  // Auto-scroll to today (right side) on initial mount or timeframe change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [timeframe]);

  // Color mapper based on level strictly for real data
  const getCellColor = (day: DayPnLRecord) => {
    if (day.isFuture) {
      return 'bg-transparent border border-transparent pointer-events-none opacity-0';
    }
    if (day.isWeekend) {
      return 'bg-bg-tertiary/20 dark:bg-slate-900/30 border border-border/10 opacity-35 hover:opacity-80';
    }

    // Days without verified closing price data or snapshots stay neutral
    if (!day.hasRealData) {
      return 'bg-bg-tertiary/40 dark:bg-slate-800/40 border border-border/30 hover:border-accent/40';
    }

    // Real profit levels: 1 to 4
    if (day.level === 4) {
      return 'bg-emerald-400 border border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.45)]';
    }
    if (day.level === 3) {
      return 'bg-emerald-500/85 border border-emerald-400/60 shadow-[0_0_5px_rgba(16,185,129,0.3)]';
    }
    if (day.level === 2) {
      return 'bg-emerald-500/55 border border-emerald-500/40';
    }
    if (day.level === 1) {
      return 'bg-emerald-500/25 border border-emerald-500/30';
    }

    // Real loss levels: -1 to -4
    if (day.level === -4) {
      return 'bg-rose-500 border border-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.45)]';
    }
    if (day.level === -3) {
      return 'bg-rose-500/85 border border-rose-400/60 shadow-[0_0_5px_rgba(244,63,94,0.3)]';
    }
    if (day.level === -2) {
      return 'bg-rose-500/55 border border-rose-500/40';
    }
    if (day.level === -1) {
      return 'bg-rose-500/25 border border-rose-500/30';
    }

    // Neutral / 0%
    return 'bg-bg-tertiary/60 dark:bg-slate-800/60 border border-border/40';
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const activeDisplayDay = selectedDay || hoveredDay;

  return (
    <div
      className={`rounded-3xl bg-bg-card/80 backdrop-blur-xl p-5 sm:p-7 shadow-xl relative overflow-hidden !border-none ${className}`}
      style={{ border: 'none', borderWidth: 0, outline: 'none' }}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 via-accent/15 to-purple-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-text-primary tracking-tight">
                  Günlük Kâr / Zarar Aktivite Haritası
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent border border-accent/20">
                  Zaman Serisi Matrisi
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-text-secondary">
                  Portföy getiri ve performans geçmişi
                </span>
                <span className="text-text-muted/40">•</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  BIST & TEFAS Kapanış Verileri
                </span>
                {loadingHistory && (
                  <span className="text-[10px] text-text-muted">
                    (Veriler güncelleniyor...)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Action: Timeframe Buttons + Collapse Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-secondary/70 border border-border/60">
            <button
              onClick={() => setTimeframe('1Y')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeframe === '1Y'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              1 Yıl
            </button>
            <button
              onClick={() => setTimeframe('6M')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeframe === '6M'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              6 Ay
            </button>
            <button
              onClick={() => setTimeframe('YTD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeframe === 'YTD'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              2026 (YTD)
            </button>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-bg-secondary/70 hover:bg-bg-hover border border-border/60 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title={isCollapsed ? 'Haritayı Genişlet' : 'Haritayı Daralt'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 relative z-10">
        {/* Win Rate */}
        <div className="p-3.5 rounded-2xl bg-bg-secondary/50 border border-border/50 hover:border-emerald-500/30 transition-colors">
          <span className="text-[11px] font-medium text-text-muted block">Kazanma Oranı</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-emerald-400 font-mono">
              %{heatmapData.stats.winRate}
            </span>
            <span className="text-[10px] text-text-muted">
              ({heatmapData.stats.profitableDays}k / {heatmapData.stats.lossDays}z)
            </span>
          </div>
        </div>

        {/* Current Streak */}
        <div className="p-3.5 rounded-2xl bg-bg-secondary/50 border border-border/50 hover:border-accent/30 transition-colors">
          <span className="text-[11px] font-medium text-text-muted block">Mevcut Seri</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xl font-black text-text-primary font-mono">
              {heatmapData.stats.currentStreak.count} Gün
            </span>
            {heatmapData.stats.currentStreak.type === 'win' && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                🔥 Kâr
              </span>
            )}
            {heatmapData.stats.currentStreak.type === 'loss' && (
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                📉 Zarar
              </span>
            )}
            {heatmapData.stats.currentStreak.type === 'neutral' && (
              <span className="text-xs font-bold text-text-muted">Nötr</span>
            )}
          </div>
        </div>

        {/* Best Day */}
        <div className="p-3.5 rounded-2xl bg-bg-secondary/50 border border-border/50 hover:border-emerald-500/30 transition-colors">
          <span className="text-[11px] font-medium text-text-muted block">En İyi Gün</span>
          <div className="mt-1">
            {heatmapData.stats.bestDay ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black text-emerald-400 font-mono">
                  +{formatCurrency(heatmapData.stats.bestDay.pnl)}
                </span>
                <span className="text-[10px] font-bold text-emerald-400/80">
                  (+{heatmapData.stats.bestDay.pnlPercent}%)
                </span>
              </div>
            ) : (
              <span className="text-sm text-text-muted">-</span>
            )}
          </div>
        </div>

        {/* Period Total */}
        <div className="p-3.5 rounded-2xl bg-bg-secondary/50 border border-border/50 hover:border-accent/30 transition-colors">
          <span className="text-[11px] font-medium text-text-muted block">Dönem Net K/Z</span>
          <div className="mt-1">
            <span
              className={`text-base font-black font-mono ${
                heatmapData.stats.totalPeriodPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {heatmapData.stats.totalPeriodPnL >= 0 ? '+' : ''}
              {formatCurrency(heatmapData.stats.totalPeriodPnL)}
            </span>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Heatmap Grid Section */}
          <div className="relative animate-fade-in">
        {/* Horizontal scroll container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-text-muted/40 transition-colors"
        >
          <div className="inline-block min-w-full">
            {/* Month labels row */}
            <div className="flex ml-8 mb-1.5 text-[11px] font-medium text-text-muted select-none">
              {heatmapData.weeks.map((_, wIdx) => {
                const header = heatmapData.monthHeaders.find((m) => m.weekIndex === wIdx);
                return (
                  <div key={wIdx} className="w-[15px] mr-[3px] text-left shrink-0">
                    {header && <span className="font-semibold text-text-secondary">{header.name}</span>}
                  </div>
                );
              })}
            </div>

            {/* Grid rows with weekday labels on left */}
            <div className="flex">
              {/* Day of week labels (Mon, Wed, Fri) */}
              <div className="flex flex-col justify-between text-[10px] font-semibold text-text-muted pr-2 select-none h-[126px] py-[2px]">
                <span className="leading-none">Pzt</span>
                <span className="leading-none">Çar</span>
                <span className="leading-none">Cum</span>
                <span className="leading-none opacity-40">Paz</span>
              </div>

              {/* 53 Columns of 7 Days */}
              <div className="flex gap-[3px]">
                {heatmapData.weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px] shrink-0">
                    {week.map((day) => {
                      const isHovered = hoveredDay?.date === day.date;
                      const isSelected = selectedDay?.date === day.date;

                      return (
                        <button
                          key={day.date}
                          type="button"
                          onMouseEnter={(e) => {
                            if (!day.isFuture) {
                              setHoveredDay(day);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredDay(null);
                            setTooltipPos(null);
                          }}
                          onClick={() => {
                            if (!day.isFuture) {
                              setSelectedDay(selectedDay?.date === day.date ? null : day);
                            }
                          }}
                          className={`w-[15px] h-[15px] rounded-[3px] transition-all duration-150 relative cursor-pointer ${getCellColor(
                            day
                          )} ${
                            isHovered || isSelected
                              ? 'scale-125 z-20 ring-2 ring-white/80 shadow-lg'
                              : 'hover:scale-115'
                          } ${day.isToday ? 'ring-1.5 ring-accent' : ''}`}
                          aria-label={`${day.date}: ${day.pnl} TRY`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile scroll hint */}
        <div className="flex sm:hidden items-center justify-between text-[11px] text-text-muted mt-1 px-1">
          <span>← Geçmiş günleri görmek için kaydırın</span>
          <span>Bugün →</span>
        </div>
      </div>

      {/* Floating Tooltip (Desktop hover) */}
      {hoveredDay && tooltipPos && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full mb-2.5 hidden sm:block animate-fade-in"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 8}px`,
          }}
        >
          <div className="glass-card bg-bg-card/95 border border-border shadow-2xl rounded-xl p-3 min-w-[200px] text-xs space-y-1.5 backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
              <span className="font-bold text-text-primary">
                {new Date(hoveredDay.date).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  weekday: 'short',
                })}
              </span>
              {hoveredDay.isToday && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-accent text-white uppercase">
                  Bugün
                </span>
              )}
            </div>

            {hoveredDay.isWeekend ? (
              <div className="text-text-muted italic py-0.5">Hafta Sonu • Borsa Kapalı</div>
            ) : !hoveredDay.hasRealData ? (
              <div className="py-1 space-y-1">
                <div className="text-text-muted text-[11px] flex items-center justify-between">
                  <span>Kapanış Verisi:</span>
                  <span className="font-semibold text-text-secondary">Kayıtlı Veri Yok</span>
                </div>
                {hoveredDay.transactionsCount > 0 && (
                  <div className="pt-1 border-t border-border/40 text-[11px] text-accent flex items-center gap-1 font-medium">
                    <span>📌</span>
                    <span>
                      {hoveredDay.transactionsCount} İşlem ({hoveredDay.transactionsSymbols.join(', ')})
                    </span>
                  </div>
                )}
                {hoveredDay.holdingsAtDate && hoveredDay.holdingsAtDate.length > 0 && (
                  <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-text-muted">Eldeki Varlıklar:</span>
                    <span className="font-bold text-accent font-mono truncate max-w-[130px]">
                      {hoveredDay.holdingsAtDate.map((h) => h.symbol).slice(0, 3).join(', ')}
                      {hoveredDay.holdingsAtDate.length > 3 ? ` +${hoveredDay.holdingsAtDate.length - 3}` : ''}
                    </span>
                  </div>
                )}
                <div className="pt-1 text-[10px] text-text-muted/80 text-center font-medium">
                  Detaylı varlık listesi için tıklayın 👆
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Gerçek Getiri:</span>
                  <span
                    className={`font-black font-mono text-sm ${
                      hoveredDay.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {hoveredDay.pnl >= 0 ? '+' : ''}
                    {formatCurrency(hoveredDay.pnl)} ({hoveredDay.pnl >= 0 ? '+' : ''}
                    {hoveredDay.pnlPercent}%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Portföy Değeri:</span>
                  <span className="font-semibold text-text-primary font-mono">
                    {formatCurrency(hoveredDay.portfolioValue)}
                  </span>
                </div>

                {hoveredDay.holdingsAtDate && hoveredDay.holdingsAtDate.length > 0 && (
                  <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-text-muted">Eldeki Varlıklar:</span>
                    <span className="font-bold text-accent font-mono truncate max-w-[130px]">
                      {hoveredDay.holdingsAtDate.map((h) => h.symbol).slice(0, 3).join(', ')}
                      {hoveredDay.holdingsAtDate.length > 3 ? ` +${hoveredDay.holdingsAtDate.length - 3}` : ''}
                    </span>
                  </div>
                )}

                {hoveredDay.losingHoldings && hoveredDay.losingHoldings.length > 0 && (
                  <div className="pt-1.5 border-t border-border/40 text-[11px] space-y-1">
                    <div className="text-rose-400 font-bold flex items-center justify-between">
                      <span>📉 Zarar Edenler ({hoveredDay.losingHoldings.length}):</span>
                      <span className="font-mono">-{formatCurrency(hoveredDay.totalGrossLoss)}</span>
                    </div>
                    {hoveredDay.losingHoldings.slice(0, 3).map((lh) => (
                      <div key={lh.symbol} className="flex items-center justify-between text-[10.5px]">
                        <span className="font-mono font-bold text-text-primary">{lh.symbol}</span>
                        <span className="text-rose-400 font-mono font-semibold">
                          {formatCurrency(lh.dailyPnL || 0)} ({lh.dailyPnLPercent}%)
                        </span>
                      </div>
                    ))}
                    {hoveredDay.losingHoldings.length > 3 && (
                      <div className="text-[9.5px] text-text-muted text-right">
                        +{hoveredDay.losingHoldings.length - 3} varlık daha
                      </div>
                    )}
                  </div>
                )}

                {hoveredDay.winningHoldings && hoveredDay.winningHoldings.length > 0 && (
                  <div className="pt-1 border-t border-border/40 text-[11px] space-y-1">
                    <div className="text-emerald-400 font-bold flex items-center justify-between">
                      <span>📈 Kâr Edenler ({hoveredDay.winningHoldings.length}):</span>
                      <span className="font-mono">+{formatCurrency(hoveredDay.totalGrossGain)}</span>
                    </div>
                    {hoveredDay.winningHoldings.slice(0, 2).map((wh) => (
                      <div key={wh.symbol} className="flex items-center justify-between text-[10.5px]">
                        <span className="font-mono font-bold text-text-primary">{wh.symbol}</span>
                        <span className="text-emerald-400 font-mono font-semibold">
                          +{formatCurrency(wh.dailyPnL || 0)} (+{wh.dailyPnLPercent}%)
                        </span>
                      </div>
                    ))}
                    {hoveredDay.winningHoldings.length > 2 && (
                      <div className="text-[9.5px] text-text-muted text-right">
                        +{hoveredDay.winningHoldings.length - 2} varlık daha
                      </div>
                    )}
                  </div>
                )}

                {hoveredDay.transactionsCount > 0 && (
                  <div className="pt-1 border-t border-border/40 text-[11px] text-accent flex items-center gap-1 font-medium">
                    <span>📌</span>
                    <span>
                      {hoveredDay.transactionsCount} İşlem ({hoveredDay.transactionsSymbols.join(', ')})
                    </span>
                  </div>
                )}

                <div className="pt-1 text-[10px] text-text-muted/80 text-center font-medium">
                  Hangi varlıktan ne kadar kâr/zarar edildiğini görmek için tıklayın 👆
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selected Day Full Portfolio Breakdown Inspector */}
      {selectedDay && (
        <div className="mt-5 p-5 sm:p-6 rounded-2xl bg-bg-secondary/90 border border-border shadow-2xl backdrop-blur-2xl animate-fade-in space-y-4">
          {/* Top Row: Date, PnL, Total Value, Close */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
                  selectedDay.hasRealData
                    ? selectedDay.pnl >= 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-bg-tertiary text-text-muted border border-border'
                }`}
              >
                {selectedDay.hasRealData ? (selectedDay.pnl >= 0 ? '↗' : '↘') : '•'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-text-primary">
                    {new Date(selectedDay.date).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      weekday: 'long',
                    })}
                  </span>
                  {selectedDay.isToday && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-accent text-white uppercase">
                      Bugün
                    </span>
                  )}
                  {selectedDay.isWeekend && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-tertiary text-text-muted border border-border">
                      Hafta Sonu • Borsa Kapalı
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  {selectedDay.hasRealData ? (
                    <>
                      <span
                        className={`text-lg font-black font-mono ${
                          selectedDay.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {selectedDay.pnl >= 0 ? '+' : ''}
                        {formatCurrency(selectedDay.pnl)} ({selectedDay.pnl >= 0 ? '+' : ''}
                        {selectedDay.pnlPercent}%)
                      </span>
                      <span className="text-xs text-text-muted">günlük net portföy getirisi</span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-text-muted">
                      {selectedDay.isWeekend ? 'Piyasa Kapalı' : 'Bu tarih için kayıtlı borsa kapanış fiyatı bulunmuyor'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4">
              <div className="text-left sm:text-right">
                <span className="text-[11px] text-text-muted block">O Günkü Portföy Büyüklüğü</span>
                <span className="text-base font-black text-text-primary font-mono">
                  {formatCurrency(selectedDay.portfolioValue)}
                </span>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-xl bg-bg-card hover:bg-bg-hover text-text-muted hover:text-text-primary border border-border/60 transition-colors cursor-pointer"
                title="Paneli Kapat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* DEDICATED LOSS BREAKDOWN PANEL: "Neyden Ne Zarar Ettiniz?" */}
          {selectedDay.losingHoldings && selectedDay.losingHoldings.length > 0 ? (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 sm:p-5 space-y-3 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-base shrink-0 shadow-inner">
                    📉
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-text-primary tracking-tight flex items-center gap-2">
                      <span>Neyden Ne Zarar Ettiniz? (Zarar Dökümü)</span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/30">
                        {selectedDay.losingHoldings.length} Varlık Zararda
                      </span>
                    </h4>
                    <p className="text-xs text-rose-200/80 mt-0.5">
                      Bu tarihte portföyünüze zarar yazan tüm hisse ve fonların detaylı dökümü
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-rose-300/80 block">Toplam Brüt Zarar</span>
                  <span className="text-lg font-black text-rose-400 font-mono">
                    -{formatCurrency(selectedDay.totalGrossLoss)}
                  </span>
                </div>
              </div>

              {/* Grid of Losing Assets with Exact Loss Math */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {selectedDay.losingHoldings.map((h) => (
                  <div
                    key={h.symbol}
                    className="p-3.5 rounded-xl bg-bg-card/90 border border-rose-500/30 hover:border-rose-500/60 transition-all shadow-sm flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-base text-text-primary font-mono tracking-tight">
                            {h.symbol}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                              h.assetType === 'fund'
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                            }`}
                          >
                            {h.assetType === 'fund' ? 'Fon' : 'Hisse'}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted mt-0.5 block">
                          Eldeki Miktar:{' '}
                          <strong className="text-text-secondary">{h.quantity.toLocaleString('tr-TR')} Adet</strong>
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-rose-400 font-mono block">
                          {formatCurrency(h.dailyPnL || 0)}
                        </span>
                        <span className="text-xs font-bold text-rose-300 font-mono">
                          ({h.dailyPnLPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Math Breakdown Box */}
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200/90 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">Fiyat Hareketi:</span>
                        <span className="font-mono font-semibold text-text-secondary">
                          {h.previousClosePrice != null ? formatCurrency(h.previousClosePrice) : '-'} ➔{' '}
                          {h.priceOnDate != null ? formatCurrency(h.priceOnDate) : '-'}
                          {h.priceDiff != null && (
                            <span className="text-rose-400 font-bold ml-1">
                              ({h.priceDiff < 0 ? '' : '+'}{h.priceDiff.toFixed(2)} ₺/adet)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-rose-500/15 font-semibold">
                        <span>Zarar Hesabı:</span>
                        <span className="font-mono text-rose-300">
                          {h.quantity.toLocaleString('tr-TR')} adet × {h.priceDiff != null ? h.priceDiff.toFixed(2) : '0'} ₺ ={' '}
                          {formatCurrency(h.dailyPnL || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Share of total day's loss */}
                    {h.lossSharePercent != null && h.lossSharePercent > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                          <span>Günün Toplam Zararındaki Payı:</span>
                          <span className="font-bold text-rose-300 font-mono">%{h.lossSharePercent}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-rose-950/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-500 shadow-sm"
                            style={{ width: `${Math.min(100, Math.max(6, h.lossSharePercent))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : selectedDay.hasRealData ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 text-xs text-emerald-300 shadow-sm">
              <span className="text-xl">✨</span>
              <div>
                <strong className="block font-bold text-emerald-200">Bu tarihte hiç zarar etmediniz!</strong>
                <span>Portföyünüzdeki tüm varlıklar günü kârlı veya nötr getiriyle tamamladı.</span>
              </div>
            </div>
          ) : null}

          {/* DEDICATED GAIN BREAKDOWN PANEL: "Neyden Ne Kazandınız?" */}
          {selectedDay.winningHoldings && selectedDay.winningHoldings.length > 0 && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 sm:p-5 space-y-3 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-base shrink-0 shadow-inner">
                    📈
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-text-primary tracking-tight flex items-center gap-2">
                      <span>Neyden Ne Kazandınız? (Kâr Dökümü)</span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/30">
                        {selectedDay.winningHoldings.length} Varlık Kârda
                      </span>
                    </h4>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      Bu tarihte değer kazanan varlıklarınız ve portföyünüze sağladıkları net kârlar
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-300/80 block">Toplam Brüt Kâr</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    +{formatCurrency(selectedDay.totalGrossGain)}
                  </span>
                </div>
              </div>

              {/* Grid of Winning Assets with Exact Gain Math */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {selectedDay.winningHoldings.map((h) => (
                  <div
                    key={h.symbol}
                    className="p-3.5 rounded-xl bg-bg-card/90 border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-sm flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-base text-text-primary font-mono tracking-tight">
                            {h.symbol}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                              h.assetType === 'fund'
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                            }`}
                          >
                            {h.assetType === 'fund' ? 'Fon' : 'Hisse'}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted mt-0.5 block">
                          Eldeki Miktar:{' '}
                          <strong className="text-text-secondary">{h.quantity.toLocaleString('tr-TR')} Adet</strong>
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-emerald-400 font-mono block">
                          +{formatCurrency(h.dailyPnL || 0)}
                        </span>
                        <span className="text-xs font-bold text-emerald-300 font-mono">
                          (+{h.dailyPnLPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Math Breakdown Box */}
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200/90 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">Fiyat Hareketi:</span>
                        <span className="font-mono font-semibold text-text-secondary">
                          {h.previousClosePrice != null ? formatCurrency(h.previousClosePrice) : '-'} ➔{' '}
                          {h.priceOnDate != null ? formatCurrency(h.priceOnDate) : '-'}
                          {h.priceDiff != null && (
                            <span className="text-emerald-400 font-bold ml-1">
                              (+{h.priceDiff.toFixed(2)} ₺/adet)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-500/15 font-semibold">
                        <span>Kâr Hesabı:</span>
                        <span className="font-mono text-emerald-300">
                          {h.quantity.toLocaleString('tr-TR')} adet × +{h.priceDiff != null ? h.priceDiff.toFixed(2) : '0'} ₺ ={' '}
                          +{formatCurrency(h.dailyPnL || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Share of total day's gain */}
                    {h.gainSharePercent != null && h.gainSharePercent > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                          <span>Günün Toplam Kârındaki Payı:</span>
                          <span className="font-bold text-emerald-300 font-mono">%{h.gainSharePercent}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-emerald-950/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 shadow-sm"
                            style={{ width: `${Math.min(100, Math.max(6, h.gainSharePercent))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Holdings Section with Filter Tabs */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  📦 Bu Tarihteki Tüm Varlıklar
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-bg-tertiary text-text-muted border border-border/40">
                  {selectedDay.holdingsAtDate?.length || 0} Varlık
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-card/70 border border-border/60 self-start sm:self-auto">
                <button
                  onClick={() => setAssetFilterTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetFilterTab === 'all'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Tümü ({selectedDay.holdingsAtDate?.length || 0})
                </button>
                <button
                  onClick={() => setAssetFilterTab('loss')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetFilterTab === 'loss'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  📉 Zarar ({selectedDay.losingHoldings?.length || 0})
                </button>
                <button
                  onClick={() => setAssetFilterTab('gain')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetFilterTab === 'gain'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  📈 Kâr ({selectedDay.winningHoldings?.length || 0})
                </button>
              </div>
            </div>

            {selectedDay.holdingsAtDate && selectedDay.holdingsAtDate.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {selectedDay.holdingsAtDate
                  .filter((h) => {
                    if (assetFilterTab === 'loss') return h.dailyPnL != null && h.dailyPnL < -0.01;
                    if (assetFilterTab === 'gain') return h.dailyPnL != null && h.dailyPnL > 0.01;
                    return true;
                  })
                  .map((holding) => (
                    <div
                      key={holding.symbol}
                      className={`p-3.5 rounded-xl bg-bg-card/85 border transition-all flex items-center justify-between gap-3 group ${
                        holding.dailyPnL != null && holding.dailyPnL < -0.01
                          ? 'border-rose-500/30 hover:border-rose-500/60'
                          : holding.dailyPnL != null && holding.dailyPnL > 0.01
                          ? 'border-emerald-500/30 hover:border-emerald-500/60'
                          : 'border-border/60 hover:border-accent/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm text-text-primary font-mono tracking-tight group-hover:text-accent transition-colors">
                            {holding.symbol}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                              holding.assetType === 'fund'
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                            }`}
                          >
                            {holding.assetType === 'fund' ? 'Fon' : 'Hisse'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                          <span className="font-medium text-text-secondary">
                            {holding.quantity.toLocaleString('tr-TR')} Adet
                          </span>
                          {holding.priceOnDate != null && (
                            <>
                              <span>•</span>
                              <span>{formatCurrency(holding.priceOnDate)}</span>
                            </>
                          )}
                        </div>

                        {/* Price diff info */}
                        {holding.previousClosePrice != null && holding.priceOnDate != null && holding.priceDiff != null && (
                          <div className="mt-1 text-[10.5px] text-text-muted font-mono">
                            Dün: {formatCurrency(holding.previousClosePrice)} ➔ Bugün: {formatCurrency(holding.priceOnDate)}
                          </div>
                        )}

                        {/* If transactions occurred today */}
                        {holding.todayTransactions && holding.todayTransactions.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            {holding.todayTransactions.map((tx, idx) => (
                              <span
                                key={idx}
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  tx.type === 'buy'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {tx.type === 'buy' ? 'Alış:' : 'Satış:'} {tx.quantity} @ {formatCurrency(tx.price)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right side: Asset's PnL on this date */}
                      <div className="text-right shrink-0">
                        {holding.dailyPnL != null && holding.dailyPnL !== 0 ? (
                          <div>
                            <span
                              className={`text-xs font-black font-mono block ${
                                holding.dailyPnL > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {holding.dailyPnL > 0 ? '+' : ''}
                              {formatCurrency(holding.dailyPnL)}
                            </span>
                            <span
                              className={`text-[10px] font-bold block ${
                                holding.dailyPnL > 0 ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {holding.dailyPnL > 0 ? '+' : ''}{holding.dailyPnLPercent}%
                            </span>
                            <span
                              className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded mt-1 inline-block ${
                                holding.dailyPnL > 0
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {holding.dailyPnL > 0 ? 'Kâr' : 'Zarar'}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs font-mono font-semibold text-text-secondary block">
                              {formatCurrency(holding.quantity * (holding.priceOnDate || holding.averageCost || 0))}
                            </span>
                            <span className="text-[10px] text-text-muted">Toplam Değer</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl bg-bg-card/40 border border-dashed border-border text-xs text-text-muted">
                Bu tarihte portföyünüzde kayıtlı bir hisse senedi veya fon bulunmuyordu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer: Legend & Info */}
      <div className="mt-5 pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <span>{heatmapData.stats.totalTradingDays} İşlem Günü İncelendi</span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">{heatmapData.stats.profitableDays} Kârlı</span>
          <span>•</span>
          <span className="text-rose-400 font-semibold">{heatmapData.stats.lossDays} Zararlı</span>
        </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 select-none">
            <span className="text-[11px] text-rose-400 font-medium mr-1">Zarar</span>
            <div className="w-3 h-3 rounded-[2px] bg-rose-500 border border-rose-300" title="> %3 Zarar" />
            <div className="w-3 h-3 rounded-[2px] bg-rose-500/85 border border-rose-400/60" title="%1.5 - %3 Zarar" />
            <div className="w-3 h-3 rounded-[2px] bg-rose-500/55 border border-rose-500/40" title="%0.5 - %1.5 Zarar" />
            <div className="w-3 h-3 rounded-[2px] bg-rose-500/25 border border-rose-500/30" title="%0 - %0.5 Zarar" />
            <div className="w-3 h-3 rounded-[2px] bg-bg-tertiary/60 border border-border/40" title="Nötr" />
            <div className="w-3 h-3 rounded-[2px] bg-emerald-500/25 border border-emerald-500/30" title="%0 - %0.5 Kâr" />
            <div className="w-3 h-3 rounded-[2px] bg-emerald-500/55 border border-emerald-500/40" title="%0.5 - %1.5 Kâr" />
            <div className="w-3 h-3 rounded-[2px] bg-emerald-500/85 border border-emerald-400/60" title="%1.5 - %3 Kâr" />
            <div className="w-3 h-3 rounded-[2px] bg-emerald-400 border border-emerald-300" title="> %3 Kâr" />
            <span className="text-[11px] text-emerald-400 font-medium ml-1">Kâr</span>
          </div>
        </div>
      </>
    )}
  </div>
);
}
export default DailyPnLCalendarHeatmap;
