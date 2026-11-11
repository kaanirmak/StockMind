'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { maskDisplayValue } from '@/lib/privacy';

export interface AllocationItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface PortfolioAllocationChartProps {
  allocation: AllocationItem[];
  totalValue: number;
  compact?: boolean;
}

/** Precomputes cumulative SVG stroke offsets so render never mutates a running variable. */
function buildAllocationSegments(allocation: AllocationItem[]) {
  return allocation.reduce<Array<{ item: AllocationItem; start: number }>>((acc, item) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : null;
    const start = prev ? prev.start + prev.item.percentage / 100 : 0;
    acc.push({ item, start });
    return acc;
  }, []);
}

export const PortfolioAllocationChart: React.FC<PortfolioAllocationChartProps> = ({
  allocation,
  totalValue,
  compact = false,
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { isPrivacyMode } = usePrivacyMode();
  const segments = buildAllocationSegments(allocation);
  if (compact) {
    const circumference = 2 * Math.PI * 39;
    return <>
      <button type="button" disabled={!allocation.length} aria-label="Varlık dağılımı ayrıntıları" onClick={() => setDetailsOpen(true)} className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-full">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="39" fill="none" stroke="var(--border)" strokeWidth="12" />
          {segments.map(({ item, start }) => (
            <circle key={item.label} cx="50" cy="50" r="39" fill="none" stroke={item.color} strokeWidth="12" strokeDasharray={`${circumference * item.percentage / 100} ${circumference}`} strokeDashoffset={-circumference * start} />
          ))}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center text-text-primary"><span className="text-base font-semibold">{allocation.length}</span><span className="text-[10px] text-text-muted">{allocation.length ? 'Dağılım' : 'Varlık'}</span></span>
      </button>
      <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="Varlık dağılımı"><PortfolioAllocationChart allocation={allocation} totalValue={totalValue} /></Modal>
    </>;
  }
  const selectedItem = allocation.find((item) => item.label === selected);
  if (!allocation || allocation.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-text-muted text-sm">
        Varlık dağılımı bulunmuyor.
      </div>
    );
  }

  const expandedCircumference = 2 * Math.PI * 0.8;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Portföy Varlık Dağılımı</h3>
          <p className="text-xs text-text-muted">Ağırlıklara göre hisse ve fon dağılımı</p>
        </div>
        <span className="text-xs font-mono font-bold text-accent">
          {maskDisplayValue(`₺${totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, isPrivacyMode, '₺••••••')}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
        {/* SVG Donut Chart */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full -rotate-90" role="img" aria-label={`Portföy dağılımı: ${allocation.map((item) => `${item.label} yüzde ${item.percentage.toFixed(1)}`).join(', ')}`}>
            {segments.map(({ item, start }) => (
              <circle key={item.label} cx="0" cy="0" r="0.8" fill="none" stroke={item.color} strokeWidth="0.35" strokeDasharray={`${expandedCircumference * item.percentage / 100} ${expandedCircumference}`} strokeDashoffset={-expandedCircumference * start} opacity={!selected || selected === item.label ? 1 : 0.35}><title>{item.label}: %{item.percentage.toFixed(1)}</title></circle>
            ))}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">{selectedItem?.label || 'Varlık'}</span>
            <span className="text-sm font-bold font-mono text-text-primary">
              {selectedItem ? `%${selectedItem.percentage.toFixed(1)}` : `${allocation.length} Adet`}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 space-y-1.5 w-full min-w-0 max-h-[300px] overflow-y-auto pr-1">
          {allocation.map((item) => (
            <button type="button"
              aria-pressed={selected === item.label}
              onClick={() => setSelected(selected === item.label ? null : item.label)}
              key={item.label}
              className="w-full min-h-11 flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl bg-bg-tertiary/40 hover:bg-bg-tertiary/80 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-semibold text-text-primary truncate" title={item.label}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="text-text-muted whitespace-nowrap text-right">
                  {maskDisplayValue(`₺${item.value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, isPrivacyMode, '₺••••')}
                </span>
                <span className="font-bold text-text-primary min-w-[42px] text-right">
                  %{item.percentage.toFixed(1)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
