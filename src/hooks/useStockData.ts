'use client';

import { useState, useEffect, useCallback } from 'react';
import { StockMarketInfo } from '@/lib/data/stocks';
import { StockQuote } from '@/types/stock';
import { Candle } from '@/lib/indicators';

export type StockWithQuote = StockMarketInfo & StockQuote;

export function useStocks(filter?: { exchange?: string; sector?: string; search?: string }) {
  const [stocks, setStocks] = useState<StockWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter?.exchange && filter.exchange !== 'ALL') params.append('exchange', filter.exchange);
      if (filter?.sector && filter.sector !== 'ALL') params.append('sector', filter.sector);
      if (filter?.search) params.append('search', filter.search);

      const res = await fetch(`/api/stocks?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setStocks(json.data);
      } else {
        setError(json.error || 'Hisseler yüklenemedi');
      }
    } catch (err) {
      setError('Ağ hatası oluştu');
    } finally {
      setLoading(false);
    }
  }, [filter?.exchange, filter?.sector, filter?.search]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  return { stocks, loading, error, refetch: fetchStocks };
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
        const res = await fetch(`/api/stocks/${symbol}`);
        const json = await res.json();
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
        const res = await fetch(`/api/stocks/${symbol}/history?timeframe=${timeframe}`);
        const json = await res.json();
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
        const res = await fetch(`/api/stocks/${symbol}/indicators?timeframe=${timeframe}`);
        const json = await res.json();
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
