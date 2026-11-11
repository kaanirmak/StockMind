'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StockMarketInfo, StockQuote } from '@/types/stock';
import { marketJson } from '@/lib/api/clientCache';
import { Candle } from '@/lib/indicators';

export type StockWithQuote = StockMarketInfo & StockQuote;

export function useStocks(
  filter?: {
    exchange?: string;
    sector?: string;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    symbols?: readonly string[];
  },
  options?: { enabled?: boolean }
) {
  const isEnabled = options?.enabled !== false;
  const [stocks, setStocks] = useState<StockWithQuote[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState(isEnabled);
  const [error, setError] = useState<string | null>(null);
  const symbolsKey = filter?.symbols ? filter.symbols.join(',') : '';
  const filterExchange = filter?.exchange;
  const filterSector = filter?.sector;
  const filterSearch = filter?.search;
  const filterSortBy = filter?.sortBy;
  const filterOrder = filter?.order;
  const filterPage = filter?.page;
  const filterLimit = filter?.limit;

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
      if (filterExchange && filterExchange !== 'ALL') params.append('exchange', filterExchange);
      if (filterSector && filterSector !== 'ALL') params.append('sector', filterSector);
      if (filterSearch) params.append('search', filterSearch);
      if (filterSortBy) params.append('sortBy', filterSortBy);
      if (filterOrder) params.append('order', filterOrder);
      if (filterPage && filterPage >= 1) params.append('page', String(filterPage));
      if (filterLimit && filterLimit > 0) params.append('limit', String(filterLimit));
      if (symbolsKey) params.append('symbols', symbolsKey);

      const json = await marketJson<{
        success: boolean;
        data: StockWithQuote[];
        total?: number;
        totalPages?: number;
        hasMore?: boolean;
        error?: string;
      }>(`/api/stocks?${params.toString()}`, 30_000, force);
      if (current !== generation.current) return;
      setError(null);
      if (json.success) {
        const list = json.data || [];
        setStocks(list);
        setTotal(typeof json.total === 'number' ? json.total : list.length);
        setTotalPages(typeof json.totalPages === 'number' ? json.totalPages : 1);
        setHasMore(Boolean(json.hasMore));
        setUpdatedAt(new Date());
      } else {
        setError(json.error || 'Hisseler yüklenemedi');
      }
    } catch (err) {
      if (current === generation.current) setError('Piyasa verilerine ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [
    isEnabled,
    filterExchange,
    filterSector,
    filterSearch,
    filterSortBy,
    filterOrder,
    filterPage,
    filterLimit,
    symbolsKey,
  ]);

  const invalidateGeneration = useCallback(() => {
    generation.current++;
  }, []);

  useEffect(() => {
    void fetchStocks();
    return invalidateGeneration;
  }, [fetchStocks, invalidateGeneration]);

  return { stocks, total, totalPages, hasMore, loading, error, updatedAt, refetch: () => fetchStocks(true) };
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
  const [historyMeta, setHistoryMeta] = useState<{ source?: string | null; fetchedAt?: string | null }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const json = await marketJson<{
          success: boolean;
          data: Candle[];
          observation?: { source?: string | null; fetchedAt?: string | null };
          error?: string;
        }>(`/api/stocks/${encodeURIComponent(symbol)}/history?timeframe=${timeframe}`, 60_000);
        if (isMounted) {
          if (json.success && Array.isArray(json.data)) {
            setCandles(json.data);
            setHistoryMeta({
              source: json.observation?.source ?? null,
              fetchedAt: json.observation?.fetchedAt ?? null,
            });
          } else {
            setCandles([]);
            setHistoryMeta({});
            setError(json.error || 'Tarihsel veri alınamadı');
          }
        }
      } catch (err) {
        if (isMounted) {
          setCandles([]);
          setHistoryMeta({});
          setError('Tarihsel veri alınamadı');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [symbol, timeframe]);

  return { candles, historyMeta, loading, error };
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
