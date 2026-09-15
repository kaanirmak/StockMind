'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { Candle, BollingerBandsResult, calculateSMA, calculateBollingerBands } from '@/lib/indicators';

export interface CandlestickChartProps {
  candles: Candle[];
  symbol: string;
  height?: number;
  bollingerBands?: BollingerBandsResult[];
  sma20?: { time: string | number; value: number }[];
  sma50?: { time: string | number; value: number }[];
  showSMA20?: boolean;
  showSMA50?: boolean;
  showBB?: boolean;
  showVolume?: boolean;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  symbol,
  height = 450,
  bollingerBands = [],
  sma20 = [],
  sma50 = [],
  showSMA20 = true,
  showSMA50 = false,
  showBB = false,
  showVolume = true,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    // Initialize chart
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)', style: 1 },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)', style: 1 },
      },
      crosshair: {
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        textColor: '#94a3b8',
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: height,
    });

    chartRef.current = chart;

    // Format candle data
    const formattedCandles = candles.map((c) => ({
      time: String(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // Add Candlestick Series (supporting lightweight-charts v4/v5)
    let candleSeries: any;
    try {
      if (typeof (chart as any).addCandlestickSeries === 'function') {
        candleSeries = (chart as any).addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
        });
      } else if (CandlestickSeries) {
        candleSeries = (chart as any).addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
        });
      }
    } catch (e) {
      console.error('Error creating candlestick series:', e);
    }

    if (candleSeries && formattedCandles.length > 0) {
      candleSeries.setData(formattedCandles);
    }

    // Volume series
    if (showVolume) {
      try {
        let volumeSeries: any;
        const volumeData = candles.map((c) => ({
          time: String(c.time),
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
        }));

        if (typeof (chart as any).addHistogramSeries === 'function') {
          volumeSeries = (chart as any).addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '', // overlay
          });
        } else if (HistogramSeries) {
          volumeSeries = (chart as any).addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
          });
        }

        if (volumeSeries && volumeData.length > 0) {
          volumeSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.8,
              bottom: 0,
            },
          });
          volumeSeries.setData(volumeData);
        }
      } catch (e) {
        console.warn('Volume series init:', e);
      }
    }

    // SMA 20 Overlay (calculated on current candles to guarantee exact date sync)
    if (showSMA20 && formattedCandles.length >= 5) {
      try {
        let smaSeries: any;
        const period = Math.min(20, Math.floor(formattedCandles.length / 2) || 5);
        const calculatedSMA20 = calculateSMA(candles, period);
        const smaData = calculatedSMA20.map((s) => ({ time: String(s.time), value: s.value as number }));
        
        if (typeof (chart as any).addLineSeries === 'function') {
          smaSeries = (chart as any).addLineSeries({
            color: '#f59e0b',
            lineWidth: 2,
            title: `SMA ${period}`,
          });
        } else if (LineSeries) {
          smaSeries = (chart as any).addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 2,
            title: `SMA ${period}`,
          });
        }
        if (smaSeries && smaData.length > 0) smaSeries.setData(smaData);
      } catch (e) {
        console.warn('SMA20 init:', e);
      }
    }

    // SMA 50 Overlay
    if (showSMA50 && formattedCandles.length >= 10) {
      try {
        let smaSeries: any;
        const period = Math.min(50, Math.floor(formattedCandles.length * 0.8) || 10);
        const calculatedSMA50 = calculateSMA(candles, period);
        const smaData = calculatedSMA50.map((s) => ({ time: String(s.time), value: s.value as number }));
        
        if (typeof (chart as any).addLineSeries === 'function') {
          smaSeries = (chart as any).addLineSeries({
            color: '#3b82f6',
            lineWidth: 2,
            title: `SMA ${period}`,
          });
        } else if (LineSeries) {
          smaSeries = (chart as any).addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            title: `SMA ${period}`,
          });
        }
        if (smaSeries && smaData.length > 0) smaSeries.setData(smaData);
      } catch (e) {
        console.warn('SMA50 init:', e);
      }
    }

    // Bollinger Bands Overlay
    if (showBB && formattedCandles.length >= 10) {
      try {
        const calculatedBB = calculateBollingerBands(candles, Math.min(20, formattedCandles.length - 2), 2);
        const upperData = calculatedBB.map((b) => ({ time: String(b.time), value: b.upper }));
        const lowerData = calculatedBB.map((b) => ({ time: String(b.time), value: b.lower }));

        let upperSeries: any;
        let lowerSeries: any;

        if (typeof (chart as any).addLineSeries === 'function') {
          upperSeries = (chart as any).addLineSeries({ color: 'rgba(139, 92, 246, 0.6)', lineWidth: 1 });
          lowerSeries = (chart as any).addLineSeries({ color: 'rgba(139, 92, 246, 0.6)', lineWidth: 1 });
        } else if (LineSeries) {
          upperSeries = (chart as any).addSeries(LineSeries, { color: 'rgba(139, 92, 246, 0.6)', lineWidth: 1 });
          lowerSeries = (chart as any).addSeries(LineSeries, { color: 'rgba(139, 92, 246, 0.6)', lineWidth: 1 });
        }

        if (upperSeries && upperData.length > 0) upperSeries.setData(upperData);
        if (lowerSeries && lowerData.length > 0) lowerSeries.setData(lowerData);
      } catch (e) {
        console.warn('Bollinger Bands init:', e);
      }
    }

    // Crosshair listener for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > height
      ) {
        setHoveredCandle(null);
      } else if (candleSeries) {
        const data = param.seriesData.get(candleSeries) as any;
        if (data) {
          setHoveredCandle({
            time: String(param.time),
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
          });
        }
      }
    });

    // Resize observer
    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, height, showSMA20, showSMA50, showBB, showVolume, sma20, sma50, bollingerBands]);

  const latestCandle = candles[candles.length - 1];
  const activeCandle = hoveredCandle || latestCandle;

  return (
    <div className="relative w-full rounded-2xl bg-bg-card border border-border overflow-hidden p-4">
      {/* Candle Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 border-b border-border/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-text-primary">{symbol}</span>
          <span className="text-text-muted">|</span>
          {activeCandle && (
            <div className="flex items-center gap-3 font-mono">
              <span className="text-text-muted">
                A: <span className="text-text-primary">{activeCandle.open?.toFixed(2)}</span>
              </span>
              <span className="text-text-muted">
                Y: <span className="text-success">{activeCandle.high?.toFixed(2)}</span>
              </span>
              <span className="text-text-muted">
                D: <span className="text-danger">{activeCandle.low?.toFixed(2)}</span>
              </span>
              <span className="text-text-muted">
                K: <span className={activeCandle.close >= activeCandle.open ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                  {activeCandle.close?.toFixed(2)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Legend Indicators */}
        <div className="flex items-center gap-3 text-[11px]">
          {showSMA20 && <span className="text-warning flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> SMA 20</span>}
          {showSMA50 && <span className="text-info flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-info inline-block" /> SMA 50</span>}
          {showBB && <span className="text-accent-secondary flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-accent-secondary inline-block" /> Bollinger</span>}
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full relative" />
    </div>
  );
};
