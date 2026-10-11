'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { useTheme } from '@/components/theme/ThemeProvider';
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
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [chartType, setChartType] = useState<'candles' | 'line'>('candles');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const { resolvedTheme } = useTheme();

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!chartWrapperRef.current) return;
    if (!isFullscreen) {
      if (chartWrapperRef.current.requestFullscreen) {
        chartWrapperRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Trigger resize on fullscreen change
      setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: isFullscreen ? window.innerHeight - 80 : getResponsiveHeight(),
          });
          chartRef.current.timeScale().fitContent();
        }
      }, 100);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isFullscreen]);

  const getResponsiveHeight = () => {
    if (typeof window === 'undefined') return height;
    if (window.innerWidth < 640) return 330; // Mobile compact
    if (window.innerWidth < 1024) return 380; // Tablet
    return height;
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const isDark = resolvedTheme !== 'light';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(226, 232, 240, 0.7)';
    const borderColor = isDark ? '#1e293b' : '#e2e8f0';
    const labelBg = isDark ? '#1e293b' : '#334155';

    const effectiveHeight = isFullscreen ? window.innerHeight - 80 : getResponsiveHeight();

    // Initialize chart with mobile-optimized touch scrolling
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: textColor,
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: gridColor, style: 1 },
        horzLines: { color: gridColor, style: 1 },
      },
      crosshair: {
        vertLine: {
          color: isDark ? '#8b5cf6' : '#7c3aed',
          width: 1,
          style: 3,
          labelBackgroundColor: labelBg,
        },
        horzLine: {
          color: isDark ? '#8b5cf6' : '#7c3aed',
          width: 1,
          style: 3,
          labelBackgroundColor: labelBg,
        },
      },
      rightPriceScale: {
        borderColor: borderColor,
        textColor: textColor,
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.22 : 0.08,
        },
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false, // Critical: prevent chart from locking mobile vertical page scrolling
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true, // Smooth mobile pinch to zoom
      },
      width: container.clientWidth,
      height: effectiveHeight,
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

    let mainSeries: any;

    try {
      if (chartType === 'candles') {
        // Candlestick Series
        if (typeof (chart as any).addCandlestickSeries === 'function') {
          mainSeries = (chart as any).addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
          });
        } else if (CandlestickSeries) {
          mainSeries = (chart as any).addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
          });
        }
        if (mainSeries && formattedCandles.length > 0) {
          mainSeries.setData(formattedCandles);
        }
      } else {
        // Line Series for ultra-clean mobile reading
        const lineData = formattedCandles.map((c) => ({ time: c.time, value: c.close }));
        if (typeof (chart as any).addLineSeries === 'function') {
          mainSeries = (chart as any).addLineSeries({
            color: '#6366f1',
            lineWidth: 2.5,
            priceLineVisible: true,
          });
        } else if (LineSeries) {
          mainSeries = (chart as any).addSeries(LineSeries, {
            color: '#6366f1',
            lineWidth: 2.5,
            priceLineVisible: true,
          });
        }
        if (mainSeries && lineData.length > 0) {
          mainSeries.setData(lineData);
        }
      }
    } catch (e) {
      console.error('Error creating main price series:', e);
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
              top: 0.82,
              bottom: 0,
            },
          });
          volumeSeries.setData(volumeData);
        }
      } catch (e) {
        console.warn('Volume series init:', e);
      }
    }

    // SMA 20 Overlay
    if (showSMA20 && formattedCandles.length >= 5) {
      try {
        let smaSeries: any;
        const period = Math.min(20, Math.floor(formattedCandles.length / 2) || 5);
        const calculatedSMA20 = calculateSMA(candles, period);
        const smaData = calculatedSMA20.map((s) => ({ time: String(s.time), value: s.value as number }));

        if (typeof (chart as any).addLineSeries === 'function') {
          smaSeries = (chart as any).addLineSeries({
            color: '#f59e0b',
            lineWidth: 1.5,
            title: `SMA ${period}`,
          });
        } else if (LineSeries) {
          smaSeries = (chart as any).addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 1.5,
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
            lineWidth: 1.5,
            title: `SMA ${period}`,
          });
        } else if (LineSeries) {
          smaSeries = (chart as any).addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 1.5,
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

    // Crosshair listener for touch tooltip & HUD
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > effectiveHeight
      ) {
        setHoveredCandle(null);
      } else if (mainSeries) {
        const data = param.seriesData.get(mainSeries) as any;
        if (data) {
          if (chartType === 'candles') {
            setHoveredCandle({
              time: String(param.time),
              open: data.open,
              high: data.high,
              low: data.low,
              close: data.close,
            });
          } else {
            setHoveredCandle({
              time: String(param.time),
              open: data.value,
              high: data.value,
              low: data.value,
              close: data.value,
            });
          }
        }
      }
    });

    // Fit content smoothly on load
    chart.timeScale().fitContent();

    // Resize observer
    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: isFullscreen ? window.innerHeight - 80 : getResponsiveHeight(),
        });
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
  }, [
    candles,
    height,
    chartType,
    showSMA20,
    showSMA50,
    showBB,
    showVolume,
    sma20,
    sma50,
    bollingerBands,
    resolvedTheme,
    isFullscreen,
  ]);

  const latestCandle = candles[candles.length - 1];
  const activeCandle = hoveredCandle || latestCandle;
  const candleChangePercent =
    activeCandle && activeCandle.open
      ? (((activeCandle.close - activeCandle.open) / activeCandle.open) * 100)
      : 0;

  return (
    <div
      ref={chartWrapperRef}
      className={`relative w-full rounded-2xl bg-bg-card border border-border overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 p-4 sm:p-6 bg-bg-primary rounded-none' : 'p-3 sm:p-4'
      }`}
    >
      {/* Top Header: Mobile-Friendly OHLCV & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5 pb-2.5 border-b border-border/40">
        {/* Left: Active Candle HUD */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-bold text-xs sm:text-sm text-text-primary shrink-0">{symbol}</span>
          <span className="text-text-muted text-xs shrink-0">|</span>

          {activeCandle && (
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono overflow-x-auto no-scrollbar">
              <span className="font-bold text-text-primary">
                {activeCandle.close?.toFixed(2)}
              </span>
              <span
                className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                  candleChangePercent >= 0 ? 'text-success bg-success/15' : 'text-danger bg-danger/15'
                }`}
              >
                {candleChangePercent >= 0 ? '+' : ''}
                {candleChangePercent.toFixed(2)}%
              </span>

              {chartType === 'candles' && (
                <div className="hidden xs:flex items-center gap-2 text-text-muted text-[10px]">
                  <span>A: <strong className="text-text-secondary">{activeCandle.open?.toFixed(2)}</strong></span>
                  <span>Y: <strong className="text-success">{activeCandle.high?.toFixed(2)}</strong></span>
                  <span>D: <strong className="text-danger">{activeCandle.low?.toFixed(2)}</strong></span>
                </div>
              )}

              {activeCandle.time && (
                <span className="text-[10px] text-text-muted ml-1 hidden md:inline">
                  {String(activeCandle.time)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Chart Controls & Mode Toggles */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
          {/* Chart Style Toggle (Candles vs Line) */}
          <div className="flex items-center bg-bg-secondary p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setChartType('candles')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                chartType === 'candles'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Mum Grafiği"
            >
              📊 Mum
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                chartType === 'line'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Çizgi Grafik"
            >
              📈 Çizgi
            </button>
          </div>

          {/* Reset Zoom Button */}
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded-lg bg-bg-secondary border border-border text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xs"
            title="Ölçeği Sıfırla"
          >
            🎯
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-bg-secondary border border-border text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xs"
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        ref={chartContainerRef}
        className="w-full relative touch-pan-x"
        style={{ touchAction: 'pan-x' }}
      />

      {/* Mobile Touch Tip Indicator */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span>👆</span>
          <span>Yakınlaştırmak için iki parmakla sıkıştırın, fiyat görmek için basılı tutun</span>
        </span>
        <div className="flex items-center gap-2 font-medium">
          {showSMA20 && <span className="text-warning flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-warning" /> SMA20</span>}
          {showSMA50 && <span className="text-info flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-info" /> SMA50</span>}
        </div>
      </div>
    </div>
  );
};
