'use client';

import React, { useEffect, useRef, memo } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  theme?: 'dark' | 'light';
  height?: number | string;
}

export function getTradingViewWidgetSymbol(symbol: string, exchange?: string): string {
  const sym = symbol.toUpperCase().trim();

  // Commodities & Precious Metals
  if (sym === 'XAUUSD' || sym === 'GOLD') return 'OANDA:XAUUSD';
  if (sym === 'XAGUSD' || sym === 'SILVER') return 'TVC:SILVER';
  if (sym === 'XAUTRYG' || sym === 'XAUTRY') return 'BIST:ALTIN.S1';
  if (sym === 'UKOIL' || sym === 'BRENT') return 'TVC:UKOIL';
  if (sym === 'USOIL' || sym === 'WTI') return 'TVC:USOIL';

  // Forex
  if (sym === 'USDTRY') return 'FX_IDC:USDTRY';
  if (sym === 'EURTRY') return 'FX_IDC:EURTRY';
  if (sym === 'GBPTRY') return 'FX_IDC:GBPTRY';
  if (sym === 'EURUSD') return 'FX_IDC:EURUSD';
  if (sym === 'USDJPY') return 'FX_IDC:USDJPY';

  // Crypto
  if (sym === 'BTCUSD' || sym === 'BTCUSDT' || sym === 'BTC') return 'BINANCE:BTCUSDT';
  if (sym === 'ETHUSD' || sym === 'ETHUSDT' || sym === 'ETH') return 'BINANCE:ETHUSDT';
  if (sym === 'SOLUSD' || sym === 'SOLUSDT' || sym === 'SOL') return 'BINANCE:SOLUSDT';
  if (sym === 'XRPUSD' || sym === 'XRPUSDT') return 'BINANCE:XRPUSDT';
  if (sym === 'AVAXUSD' || sym === 'AVAXUSDT') return 'BINANCE:AVAXUSDT';

  // BIST Indices
  if (sym === 'XU100' || sym === 'BIST100') return 'BIST:XU100';
  if (sym === 'XU030' || sym === 'BIST30') return 'BIST:XU030';

  // Explicit Exchange
  if (exchange === 'BIST') return `BIST:${sym}`;
  if (exchange === 'NASDAQ') return `NASDAQ:${sym}`;
  if (exchange === 'NYSE') return `NYSE:${sym}`;

  // Heuristics
  const isUsStock = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOG', 'GOOGL', 'META', 'NFLX', 'PLTR', 'UBER', 'COIN', 'SOFI', 'MSTR', 'SMCI', 'RKLB', 'HOOD', 'AMD', 'INTC', 'CRM'].includes(sym);
  if (isUsStock) {
    return `NASDAQ:${sym}`;
  }

  return `BIST:${sym}`;
}

export const TradingViewChart = memo(function TradingViewChart({
  symbol,
  exchange,
  theme: customTheme,
  height = 560,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = getTradingViewWidgetSymbol(symbol, exchange);
  const { resolvedTheme } = useTheme();

  const activeTheme = customTheme || resolvedTheme || 'dark';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    widgetWrapper.style.height = '100%';
    widgetWrapper.style.width = '100%';
    container.appendChild(widgetWrapper);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Europe/Istanbul',
      theme: activeTheme,
      style: '1', // Candlestick
      locale: 'tr',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      backgroundColor: activeTheme === 'light' ? '#ffffff' : '#0a0e1a',
      gridColor: activeTheme === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      studies: [
        'MASimple@tv-basicstudies',
        'RSI@tv-basicstudies',
      ],
      toolbar_bg: activeTheme === 'light' ? '#f8fafc' : '#0f172a',
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [tvSymbol, activeTheme]);

  return (
    <div className="tradingview-widget-container rounded-2xl overflow-hidden border border-border shadow-xl bg-bg-card" style={{ height }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
});
