'use client';

import { useId } from 'react';

interface QuantSymbolSelectProps {
  value: string;
  onChange: (symbol: string) => void;
  portfolioStocks: { symbol: string }[];
  fallbackSymbols: string[];
}

export default function QuantSymbolSelect({ value, onChange, portfolioStocks, fallbackSymbols }: QuantSymbolSelectProps) {
  const id = useId();
  const symbols = [...new Set((portfolioStocks.length ? portfolioStocks.map((holding) => holding.symbol) : fallbackSymbols).map((symbol) => symbol.toUpperCase()))];
  const selected = value.toUpperCase();
  if (!symbols.includes(selected)) symbols.unshift(selected);

  return (
    <div className="w-full min-w-0 sm:w-52 sm:shrink-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-text-muted">
        {portfolioStocks.length ? 'Portföyden hisse seç' : 'Hisse seç'}
      </label>
      <select
        id={id}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-base font-semibold text-text-primary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-sm"
      >
        {symbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
      </select>
    </div>
  );
}
