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
  },
  options?: { enabled?: boolean }
) {
  const isEnabled = options?.enabled !== false;
  const [funds, setFunds] = useState<TefasFundInfo[]>([]);
  const [loading, setLoading] = useState(isEnabled);
  const [error, setError] = useState<string | null>(null);

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

      const json = await marketJson<{ success: boolean; data: TefasFundInfo[]; error?: string }>(`/api/funds?${params.toString()}`, 60_000, force);
      if (current !== generation.current) return;
      setError(null);
      if (json.success) {
        setFunds(json.data);
      } else {
        setError(json.error || 'Fonlar yüklenemedi');
      }
    } catch (err) {
      if (current === generation.current) setError('Fon verileri alınamadı. Lütfen tekrar deneyin.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [isEnabled, filter?.category, filter?.search, filter?.minRisk, filter?.maxRisk]);

  useEffect(() => {
    void fetchFunds();
    return () => { generation.current++; };
  }, [fetchFunds]);

  return { funds, loading, error, refetch: () => fetchFunds(true) };
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
