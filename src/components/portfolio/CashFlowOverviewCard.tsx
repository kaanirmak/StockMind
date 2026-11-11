'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  buildCashFlowViewReport,
  type CashFlowEventKind,
  type CashFlowPeriodFilter,
} from '@/lib/portfolio/cashFlowView';
import type { CashMovement, Transaction } from '@/types/portfolio';
import type { PriceQuote } from '@/lib/portfolio/calculations';
import { maskDisplayValue } from '@/lib/privacy';

interface CashFlowOverviewCardProps {
  transactions: Transaction[];
  cashMovements: CashMovement[];
  livePrices: Record<string, PriceQuote | number>;
  isPrivacyMode?: boolean;
}

const PERIOD_OPTIONS: { id: CashFlowPeriodFilter; label: string }[] = [
  { id: '7D', label: '7G' },
  { id: '1M', label: '1A' },
  { id: '3M', label: '3A' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'Tümü' },
];

const KIND_OPTIONS: { id: CashFlowEventKind | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'deposit', label: 'Para Girişi' },
  { id: 'withdrawal', label: 'Para Çıkışı' },
  { id: 'dividend', label: 'Temettü' },
  { id: 'fee', label: 'Ücret' },
];

function fmtCurrency(amount: number, currency: string, privacy: boolean): string {
  const prefix = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;
  return maskDisplayValue(
    `${prefix}${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    privacy,
    `${prefix}••••`
  );
}

export function CashFlowOverviewCard({
  transactions,
  cashMovements,
  livePrices,
  isPrivacyMode = false,
}: CashFlowOverviewCardProps) {
  const [period, setPeriod] = useState<CashFlowPeriodFilter>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [kindFilter, setKindFilter] = useState<CashFlowEventKind | 'ALL'>('ALL');

  const report = useMemo(
    () =>
      buildCashFlowViewReport({
        transactions,
        cashMovements,
        period,
        currencyFilter,
        kinds: kindFilter === 'ALL' ? undefined : [kindFilter],
        livePrices,
      }),
    [transactions, cashMovements, period, currencyFilter, kindFilter, livePrices]
  );

  const displayTotals = report.totalsInSelectedCurrency ?? report.totalsTry;
  const summaryCurrency = currencyFilter !== 'ALL' ? currencyFilter : 'TRY';

  return (
    <section className="glass-card p-4 sm:p-5 space-y-4" data-testid="cash-flow-overview-card">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-text-primary">
            Nakit Akışı Görünümü
          </h3>
          <p className="text-xs text-text-muted">
            Para girişleri, çıkışları, temettü ödemeleri ve işlem/saklama ücretlerini dönem ve para birimine göre filtreleyin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-bg-secondary border border-border p-0.5">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  period === p.id ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Nakit akışı para birimi filtresi"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="bg-bg-secondary text-text-primary border border-border rounded-xl px-2.5 py-1.5 text-xs font-semibold"
          >
            <option value="ALL">Tüm Para Birimleri (TRY Baz)</option>
            {report.availableCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Nakit akışı türü filtresi"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as CashFlowEventKind | 'ALL')}
            className="bg-bg-secondary text-text-primary border border-border rounded-xl px-2.5 py-1.5 text-xs font-semibold"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Totals Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Para Girişleri</span>
          <span className="text-sm font-mono font-bold text-success">
            +{fmtCurrency(displayTotals.deposits, summaryCurrency, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Para Çıkışları</span>
          <span className="text-sm font-mono font-bold text-danger">
            -{fmtCurrency(displayTotals.withdrawals, summaryCurrency, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Temettü</span>
          <span className="text-sm font-mono font-bold text-success">
            +{fmtCurrency(displayTotals.dividends, summaryCurrency, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Ücret & Komisyon</span>
          <span className="text-sm font-mono font-bold text-warning">
            -{fmtCurrency(displayTotals.fees, summaryCurrency, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50 col-span-2 lg:col-span-1">
          <span className="text-text-muted block">Net Nakit Akışı</span>
          <span
            className={`text-sm font-mono font-bold ${
              displayTotals.netCashFlow >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {displayTotals.netCashFlow >= 0 ? '+' : ''}
            {fmtCurrency(displayTotals.netCashFlow, summaryCurrency, isPrivacyMode)}
          </span>
        </div>
      </div>

      {/* Itemized Cash Flow List */}
      {report.events.length > 0 ? (
        <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
          {report.events.map((ev) => {
            const badgeVariant =
              ev.kind === 'deposit' || ev.kind === 'dividend'
                ? 'success'
                : ev.kind === 'withdrawal'
                  ? 'danger'
                  : 'warning';
            return (
              <div key={ev.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-text-muted">{ev.date}</span>
                    <Badge variant={badgeVariant} size="sm">{ev.kindLabel}</Badge>
                    {ev.symbol && <span className="font-bold text-text-primary">{ev.symbol}</span>}
                  </div>
                  <p className="text-[11px] text-text-secondary truncate mt-0.5">{ev.description}</p>
                </div>
                <div className="text-right font-mono shrink-0">
                  <span
                    className={`font-bold block ${
                      ev.signedAmount >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {ev.signedAmount >= 0 ? '+' : '-'}
                    {fmtCurrency(ev.amount, ev.currency, isPrivacyMode)}
                  </span>
                  {ev.currency !== 'TRY' && (
                    <span className="text-[10px] text-text-muted">
                      ({fmtCurrency(ev.amountTry, 'TRY', isPrivacyMode)})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Seçili dönem ve para birimi filtresine uyan nakit akışı hareketi bulunamadı.
        </p>
      )}
    </section>
  );
}
