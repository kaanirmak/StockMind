'use client';

import React from 'react';
import { Badge } from '@/components/ui';

export interface TechnicalIndicatorsPanelProps {
  indicators: any;
  currentPrice: number;
}

export const TechnicalIndicatorsPanel: React.FC<TechnicalIndicatorsPanelProps> = ({
  indicators,
  currentPrice,
}) => {
  if (!indicators || !indicators.latest) {
    return (
      <div className="glass-card p-5 text-center text-text-muted text-sm">
        Teknik göstergeler hesaplanıyor...
      </div>
    );
  }

  const { rsi, macd, sma20, sma50, signal, score } = indicators.latest;
  const bb = indicators.indicators?.bollingerBands;
  const latestBB = bb && bb.length > 0 ? bb[bb.length - 1] : null;

  const signalConfig = {
    STRONG_BUY: { label: 'GÜÇLÜ AL', color: 'success', bg: 'bg-success/20 text-success border-success/40' },
    BUY: { label: 'AL', color: 'success', bg: 'bg-success/15 text-success border-success/30' },
    NEUTRAL: { label: 'NÖTR', color: 'warning', bg: 'bg-warning/15 text-warning border-warning/30' },
    SELL: { label: 'SAT', color: 'danger', bg: 'bg-danger/15 text-danger border-danger/30' },
    STRONG_SELL: { label: 'GÜÇLÜ SAT', color: 'danger', bg: 'bg-danger/20 text-danger border-danger/40' },
  }[signal as 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'] || {
    label: 'NÖTR',
    color: 'warning',
    bg: 'bg-warning/15 text-warning',
  };

  return (
    <div className="glass-card p-5 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Teknik Analiz Göstergeleri</h3>
          <p className="text-xs text-text-muted">RSI, MACD, Hareketli Ortalamalar ve Bantlar</p>
        </div>
        <div className={`px-3 py-1 rounded-xl text-xs font-bold border ${signalConfig.bg}`}>
          {signalConfig.label}
        </div>
      </div>

      {/* Grid of indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RSI Box */}
        <div className="bg-bg-tertiary/60 border border-border/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">RSI (14)</span>
            <span
              className={`text-xs font-bold ${
                rsi > 70 ? 'text-danger' : rsi < 30 ? 'text-success' : 'text-text-primary'
              }`}
            >
              {rsi?.toFixed(1)}
            </span>
          </div>
          {/* Visual Bar */}
          <div className="w-full bg-bg-input rounded-full h-2 relative overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                rsi > 70 ? 'bg-danger' : rsi < 30 ? 'bg-success' : 'bg-accent'
              }`}
              style={{ width: `${Math.min(Math.max(rsi, 0), 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>Aşırı Satım (&lt;30)</span>
            <span>Aşırı Alım (&gt;70)</span>
          </div>
        </div>

        {/* MACD Box */}
        <div className="bg-bg-tertiary/60 border border-border/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">MACD (12, 26, 9)</span>
            <Badge variant={macd?.histogram >= 0 ? 'success' : 'danger'} size="sm">
              {macd?.histogram >= 0 ? 'Boğa / Pozitif' : 'Ayı / Negatif'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <span className="text-text-muted text-[10px] block">MACD Çizgisi</span>
              <span className="font-semibold text-text-primary">{macd?.macd?.toFixed(2) || '0.00'}</span>
            </div>
            <div>
              <span className="text-text-muted text-[10px] block">Sinyal Çizgisi</span>
              <span className="font-semibold text-text-primary">{macd?.signal?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>

        {/* Moving Averages */}
        <div className="bg-bg-tertiary/60 border border-border/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Hareketli Ortalamalar</span>
            <span className="text-[10px] font-bold text-accent">
              {currentPrice > sma20 ? 'Fiyat > SMA20' : 'Fiyat < SMA20'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <span className="text-text-muted text-[10px] block">SMA 20</span>
              <span className="font-semibold text-warning">{sma20?.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-muted text-[10px] block">SMA 50</span>
              <span className="font-semibold text-info">{sma50?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Bollinger Bands */}
        <div className="bg-bg-tertiary/60 border border-border/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Bollinger Bantları</span>
            <span className="text-[10px] text-accent-secondary font-medium">Bant Genişliği</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs pt-1 text-center">
            <div className="bg-bg-secondary/70 p-1 rounded">
              <span className="text-text-muted text-[9px] block">Alt</span>
              <span className="text-[11px] font-mono text-text-primary">{latestBB?.lower?.toFixed(1)}</span>
            </div>
            <div className="bg-bg-secondary/70 p-1 rounded">
              <span className="text-text-muted text-[9px] block">Orta</span>
              <span className="text-[11px] font-mono text-text-primary">{latestBB?.middle?.toFixed(1)}</span>
            </div>
            <div className="bg-bg-secondary/70 p-1 rounded">
              <span className="text-text-muted text-[9px] block">Üst</span>
              <span className="text-[11px] font-mono text-text-primary">{latestBB?.upper?.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
