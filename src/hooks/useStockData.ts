'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StockMarketInfo, StockQuote } from '@/types/stock';
import { marketJson } from '@/lib/api/clientCache';
import { Candle } from '@/lib/indicators';

export type StockWithQuote = StockMarketInfo & StockQuote;

export function useStocks(
  filter?: { exchange?: string; sector?: string; search?: string },
  options?: { enabled?: boolean }
) {
  const isEnabled = options?.enabled !== false;
  const [stocks, setStocks] = useState<StockWithQuote[]>([]);
  const [loading, setLoading] = useState(isEnabled);
  const [error, setError] = useState<string | null>(null);

  const generation = useRef(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fetchStocks = useCallback(async (force = false) => {
    const current = ++generation.current;
    if (!isEnabled) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter?.exchange && filter.exchange !== 'ALL') params.append('exchange', filter.exchange);
      if (filter?.sector && filter.sector !== 'ALL') params.append('sector', filter.sector);
      if (filter?.search) params.append('search', filter.search);

      const json = await marketJson<{ success: boolean; data: StockWithQuote[]; error?: string }>(`/api/stocks?${params.toString()}`, 30_000, force);
      if (current !== generation.current) return;
      setError(null);
      if (json.success) {
        setStocks(json.data);
        setUpdatedAt(new Date());
      } else {
        setError(json.error || 'Hisseler yüklenemedi');
      }
    } catch (err) {
      if (current === generation.current) setError('Piyasa verilerine ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [isEnabled, filter?.exchange, filter?.sector, filter?.search]);

  useEffect(() => {
    void fetchStocks();
    return () => { generation.current++; };
  }, [fetchStocks]);

  return { stocks, loading, error, updatedAt, refetch: () => fetchStocks(true) };
}

export function useStockDetail(symbol: string) {
  const [stock, setStock] = useState<StockWithQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const json = await marketJson<{ success: boolean; data: StockWithQuote; error?: string }>(`/api/stocks/${encodeURIComponent(symbol)}`);
        if (isMounted) {
          if (json.success) {
            setStock(json.data);
          } else {
            setError(json.error || 'Hisse bulunamadı');
          }
        }
      } catch (err) {
        if (isMounted) setError('Ağ hatası oluştu');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [symbol]);

  return { stock, loading, error };
}

export function useStockHistory(symbol: string, timeframe: string = '1M') {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const json = await marketJson<{ success: boolean; data: Candle[]; error?: string }>(`/api/stocks/${encodeURIComponent(symbol)}/history?timeframe=${timeframe}`, 60_000);
        if (isMounted) {
          if (json.success) {
            setCandles(json.data);
          } else {
            setError(json.error || 'Tarihsel veri alınamadı');
          }
        }
      } catch (err) {
        if (isMounted) setError('Ağ hatası oluştu');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [symbol, timeframe]);

  return { candles, loading, error };
}

export function useStockIndicators(symbol: string, timeframe: string = '1Y') {
  const [indicators, setIndicators] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    const fetchIndicators = async () => {
      try {
        setLoading(true);
        setError(null);
        const json = await marketJson<{ success: boolean; data: unknown; error?: string }>(`/api/stocks/${encodeURIComponent(symbol)}/indicators?timeframe=${timeframe}`, 60_000);
        if (isMounted) {
          if (json.success) {
            setIndicators(json.data);
          } else {
            setError(json.error || 'Göstergeler alınamadı');
          }
        }
      } catch (err) {
        if (isMounted) setError('Ağ hatası oluştu');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchIndicators();
    return () => {
      isMounted = false;
    };
  }, [symbol, timeframe]);

  return { indicators, loading, error };
}
