'use client';

import React from 'react';

export interface AllocationItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface PortfolioAllocationChartProps {
  allocation: AllocationItem[];
  totalValue: number;
}

export const PortfolioAllocationChart: React.FC<PortfolioAllocationChartProps> = ({
  allocation,
  totalValue,
}) => {
  if (!allocation || allocation.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-text-muted text-sm">
        Varlık dağılımı bulunmuyor.
      </div>
    );
  }

  // Calculate SVG donut slice paths
  let cumulativePercent = 0;

  function getCoordinatesForPercent(percent: number) {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Portföy Varlık Dağılımı</h3>
          <p className="text-xs text-text-muted">Ağırlıklara göre hisse ve fon dağılımı</p>
        </div>
        <span className="text-xs font-mono font-bold text-accent">
          ₺{totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
        {/* SVG Donut Chart */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90">
            {allocation.map((item, index) => {
              const startPercent = cumulativePercent;
              const slicePercent = item.percentage / 100;
              cumulativePercent += slicePercent;

              const [startX, startY] = getCoordinatesForPercent(startPercent);
              const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
              const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

              // Donut path with inner radius cutout
              const pathData = [
                `M ${startX} ${startY}`,
                `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                `L 0 0`,
              ].join(' ');

              return (
                <path
                  key={index}
                  d={pathData}
                  fill={item.color}
                  className="transition-opacity hover:opacity-80 cursor-pointer"
                />
              );
            })}
            {/* Center Donut Hole - Dinamik Tema Uyumu */}
            <circle cx="0" cy="0" r="0.65" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="0.015" />
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Varlık</span>
            <span className="text-sm font-bold font-mono text-text-primary">
              {allocation.length} Adet
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 space-y-1.5 w-full min-w-0 max-h-[300px] overflow-y-auto pr-1">
          {allocation.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl bg-bg-tertiary/40 hover:bg-bg-tertiary/80 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-semibold text-text-primary truncate" title={item.label}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="text-text-muted whitespace-nowrap text-right">
                  ₺{item.value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className="font-bold text-text-primary min-w-[42px] text-right">
                  %{item.percentage.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
