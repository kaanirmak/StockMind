'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { marketJson } from '@/lib/api/clientCache';
import { TefasFundInfo } from '@/lib/data/funds';
import type { SimilarFundRecommendation } from '@/lib/market/fundComparison';

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
  const filterCategory = filter?.category;
  const filterSearch = filter?.search;
  const filterMinRisk = filter?.minRisk;
  const filterMaxRisk = filter?.maxRisk;
  const filterRiskRange = filter?.riskRange;
  const filterFeeTier = filter?.feeTier;
  const filterReturnPeriod = filter?.returnPeriod;
  const filterReturnThreshold = filter?.returnThreshold;
  const filterSortBy = filter?.sortBy;
  const filterOrder = filter?.order;
  const filterPage = filter?.page;
  const filterLimit = filter?.limit;

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
      if (filterCategory && filterCategory !== 'ALL') params.append('category', filterCategory);
      if (filterSearch) params.append('search', filterSearch);
      if (filterMinRisk) params.append('minRisk', String(filterMinRisk));
      if (filterMaxRisk) params.append('maxRisk', String(filterMaxRisk));
      if (filterRiskRange && filterRiskRange !== 'ALL') params.append('riskRange', filterRiskRange);
      if (filterFeeTier && filterFeeTier !== 'ALL') params.append('feeTier', filterFeeTier);
      if (filterReturnPeriod) params.append('returnPeriod', filterReturnPeriod);
      if (filterReturnThreshold && filterReturnThreshold !== 'ALL') params.append('returnThreshold', filterReturnThreshold);
      if (filterSortBy) params.append('sortBy', filterSortBy);
      if (filterOrder) params.append('order', filterOrder);
      if (filterPage && filterPage >= 1) params.append('page', String(filterPage));
      if (filterLimit && filterLimit > 0) params.append('limit', String(filterLimit));
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
    filterCategory,
    filterSearch,
    filterMinRisk,
    filterMaxRisk,
    filterRiskRange,
    filterFeeTier,
    filterReturnPeriod,
    filterReturnThreshold,
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
    void fetchFunds();
    return invalidateGeneration;
  }, [fetchFunds, invalidateGeneration]);

  return { funds, total, totalPages, hasMore, loading, error, refetch: () => fetchFunds(true) };
}

export function useFundDetail(code: string, days: number = 90) {
  const [fund, setFund] = useState<
    (TefasFundInfo & {
      history: { date: string; price: number }[];
      similarFunds?: SimilarFundRecommendation[];
    }) | null
  >(null);
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
