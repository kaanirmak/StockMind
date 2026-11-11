'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { marketJson } from '@/lib/api/clientCache';
import { TefasFundInfo } from '@/lib/data/funds';

export function useFunds(
  filter?: {
    category?: string;
    search?: string;
    minRisk?: number;
    maxRisk?: number;
    riskRange?: string;
    feeTier?: string;
    returnPeriod?: string;
    returnThreshold?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    symbols?: readonly string[];
  },
  options?: { enabled?: boolean }
) {
  const isEnabled = options?.enabled !== false;
  const [funds, setFunds] = useState<TefasFundInfo[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState(isEnabled);
  const [error, setError] = useState<string | null>(null);
  const symbolsKey = filter?.symbols ? filter.symbols.join(',') : '';

  const generation = useRef(0);
  const fetchFunds = useCallback(async (force = false) => {
    const current = ++generation.current;
    if (!isEnabled) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter?.category && filter.category !== 'ALL') params.append('category', filter.category);
      if (filter?.search) params.append('search', filter.search);
      if (filter?.minRisk) params.append('minRisk', String(filter.minRisk));
      if (filter?.maxRisk) params.append('maxRisk', String(filter.maxRisk));
      if (filter?.riskRange && filter.riskRange !== 'ALL') params.append('riskRange', filter.riskRange);
      if (filter?.feeTier && filter.feeTier !== 'ALL') params.append('feeTier', filter.feeTier);
      if (filter?.returnPeriod) params.append('returnPeriod', filter.returnPeriod);
      if (filter?.returnThreshold && filter.returnThreshold !== 'ALL') params.append('returnThreshold', filter.returnThreshold);
      if (filter?.sortBy) params.append('sortBy', filter.sortBy);
      if (filter?.order) params.append('order', filter.order);
      if (filter?.page && filter.page >= 1) params.append('page', String(filter.page));
      if (filter?.limit && filter.limit > 0) params.append('limit', String(filter.limit));
      if (symbolsKey) params.append('symbols', symbolsKey);

      const json = await marketJson<{
        success: boolean;
        data: TefasFundInfo[];
        total?: number;
        totalPages?: number;
        hasMore?: boolean;
        error?: string;
      }>(`/api/funds?${params.toString()}`, 60_000, force);
      if (current !== generation.current) return;
      setError(null);
      if (json.success) {
        const list = json.data || [];
        setFunds(list);
        setTotal(typeof json.total === 'number' ? json.total : list.length);
        setTotalPages(typeof json.totalPages === 'number' ? json.totalPages : 1);
        setHasMore(Boolean(json.hasMore));
      } else {
        setError(json.error || 'Fonlar yüklenemedi');
      }
    } catch (err) {
      if (current === generation.current) setError('Fon verileri alınamadı. Lütfen tekrar deneyin.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [
    isEnabled,
    filter?.category,
    filter?.search,
    filter?.minRisk,
    filter?.maxRisk,
    filter?.riskRange,
    filter?.feeTier,
    filter?.returnPeriod,
    filter?.returnThreshold,
    filter?.sortBy,
    filter?.order,
    filter?.page,
    filter?.limit,
    symbolsKey,
  ]);

  useEffect(() => {
    void fetchFunds();
    return () => { generation.current++; };
  }, [fetchFunds]);

  return { funds, total, totalPages, hasMore, loading, error, refetch: () => fetchFunds(true) };
}

export function useFundDetail(code: string, days: number = 90) {
  const [fund, setFund] = useState<(TefasFundInfo & { history: { date: string; price: number }[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/funds/${code}?days=${days}`);
        const json = await res.json();
        if (isMounted) {
          if (json.success) {
            setFund(json.data);
          } else {
            setError(json.error || 'Fon bulunamadı');
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
  }, [code, days]);

  return { fund, loading, error };
}
